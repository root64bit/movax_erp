-- Migration 040: Guaranteed Guia de Remessa & Operational Document Cancellation with Stock Return
-- Ensures that cancelling any Guia de Remessa (or sale document) 100% returns the stock back to inventory.

CREATE OR REPLACE FUNCTION public.admin_cancel_operational_document_v2(
  p_document_id UUID,
  p_reason TEXT,
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, audit, pg_temp
AS $$
DECLARE
  v_doc public.documents;
  v_type public.document_types;
  v_move RECORD;
  v_line RECORD;
  v_restored_count INTEGER := 0;
  v_company_id UUID;
BEGIN
  IF NULLIF(TRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED: Por favor informe o motivo do cancelamento.';
  END IF;

  SELECT * INTO v_doc FROM public.documents
  WHERE id = p_document_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;

  IF v_doc.status IN ('CANCELLED', 'REVERSED') THEN
    RETURN true;
  END IF;

  IF v_doc.status NOT IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'DRAFT') THEN
    RAISE EXCEPTION 'DOCUMENT_CANNOT_BE_CANCELLED_IN_STATUS_%', v_doc.status;
  END IF;

  SELECT * INTO v_type FROM public.document_types WHERE id = v_doc.document_type_id;

  -- 1. Restore stock if document type affects stock
  IF v_type.affects_stock OR v_type.code IN ('CUSTOMER_DELIVERY_NOTE', 'CUSTOMER_INVOICE', 'CASH_SALE', 'STOCK_EXIT_GUIDE') THEN
    -- A) Try restoring from existing stock_movements first
    FOR v_move IN
      SELECT sm.product_id, sm.warehouse_id, SUM(sm.quantity_out - sm.quantity_in) AS quantity_to_restore, COALESCE(MAX(sm.unit_cost), 0) AS unit_cost
      FROM public.stock_movements sm
      WHERE sm.source_document_id = p_document_id
      GROUP BY sm.product_id, sm.warehouse_id
      HAVING SUM(sm.quantity_out - sm.quantity_in) > 0
    LOOP
      PERFORM public.post_stock_movement(
        v_doc.company_id,
        v_move.product_id,
        v_move.warehouse_id,
        'reversal',
        v_move.quantity_to_restore,
        0,
        v_move.unit_cost,
        v_doc.id,
        NULL,
        NULL,
        v_doc.customer_id,
        v_doc.supplier_id,
        'Cancelamento de ' || COALESCE(v_doc.display_number, 'documento') || ': ' || TRIM(p_reason),
        NULL
      );
      v_restored_count := v_restored_count + 1;
    END LOOP;

    -- B) If no stock_movements were recorded, restore directly from document_lines
    IF v_restored_count = 0 THEN
      FOR v_line IN
        SELECT dl.product_id, COALESCE(v_doc.warehouse_id, (SELECT id FROM warehouses WHERE company_id = v_doc.company_id ORDER BY is_default DESC LIMIT 1)) AS warehouse_id,
               SUM(dl.quantity) AS quantity_to_restore, COALESCE(MAX(dl.unit_cost_snapshot), 0) AS unit_cost
        FROM public.document_lines dl
        WHERE dl.document_id = p_document_id AND dl.product_id IS NOT NULL
        GROUP BY dl.product_id
        HAVING SUM(dl.quantity) > 0
      LOOP
        PERFORM public.post_stock_movement(
          v_doc.company_id,
          v_line.product_id,
          v_line.warehouse_id,
          'reversal',
          v_line.quantity_to_restore,
          0,
          v_line.unit_cost,
          v_doc.id,
          NULL,
          NULL,
          v_doc.customer_id,
          v_doc.supplier_id,
          'Cancelamento de ' || COALESCE(v_doc.display_number, 'documento') || ': ' || TRIM(p_reason),
          NULL
        );
      END LOOP;
    END IF;
  END IF;

  -- 2. Reverse Financial Entries if any
  UPDATE public.ledger_entries
  SET status = 'REVERSED', outstanding_amount = 0
  WHERE source_document_id = v_doc.id AND status <> 'REVERSED';

  -- 3. Document status history
  INSERT INTO public.document_status_history(company_id, document_id, previous_status, new_status, reason, changed_by)
  VALUES(v_doc.company_id, v_doc.id, v_doc.status, 'REVERSED', TRIM(p_reason), auth.uid());

  -- 4. Update Document to REVERSED (Cancelada)
  UPDATE public.documents
  SET
    status = 'REVERSED',
    outstanding_amount = 0,
    stock_posted = false,
    financial_posted = false,
    cancellation_reason = TRIM(p_reason),
    cancelled_by = auth.uid(),
    cancelled_at = now(),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = v_doc.id;

  -- 5. Refresh customer balance
  IF v_doc.customer_id IS NOT NULL THEN
    PERFORM private.refresh_customer_balance(v_doc.customer_id);
  END IF;

  -- 6. Audit event
  INSERT INTO audit.operational_events(company_id, user_id, branch_id, warehouse_id, event_type, resource_type, resource_id, reason, metadata)
  VALUES(
    v_doc.company_id,
    auth.uid(),
    v_doc.branch_id,
    v_doc.warehouse_id,
    'document.cancelled',
    'document',
    v_doc.id,
    TRIM(p_reason),
    jsonb_build_object(
      'display_number', v_doc.display_number,
      'previous_status', v_doc.status,
      'idempotency_key', p_idempotency_key
    )
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cancel_operational_document_v2(UUID, TEXT, UUID) TO authenticated, anon;
