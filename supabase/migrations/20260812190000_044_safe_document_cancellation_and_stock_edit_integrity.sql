BEGIN;

-- Editing replaces document lines. Neutralise the complete net stock effect of
-- the document first, including movements whose former line row was replaced.
CREATE OR REPLACE FUNCTION public.update_operational_document_v2(
  p_document_id UUID,
  p_client_name TEXT DEFAULT NULL,
  p_client_nuit TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL,
  p_grand_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT NULL,
  p_general_discount NUMERIC DEFAULT 0,
  p_keep_as_walk_in BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, audit, pg_temp
AS $$
DECLARE
  v_doc public.documents;
  v_type public.document_types;
  v_old_customer UUID;
  v_new_customer UUID;
  v_old_snapshot JSONB;
  v_new_snapshot JSONB;
  v_move RECORD;
  v_line RECORD;
  v_name TEXT;
  v_nuit TEXT;
  v_address TEXT;
  v_user_notes TEXT;
  v_manage_stock BOOLEAN := false;
  v_new_total NUMERIC(18,2);
  v_new_paid NUMERIC(18,2);
  v_new_outstanding NUMERIC(18,2);
BEGIN
  SELECT * INTO v_doc FROM public.documents
  WHERE id=p_document_id AND company_id=public.get_user_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF auth.uid() IS NULL OR NOT public.has_permission('sales.create') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: sales.create';
  END IF;

  SELECT * INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  IF v_doc.status IN('CANCELLED','REVERSED') THEN
    RAISE EXCEPTION 'DOCUMENT_CANNOT_BE_EDITED_IN_STATUS_%',v_doc.status;
  END IF;

  v_manage_stock:=v_type.affects_stock
    AND COALESCE(v_doc.notes,'') NOT ILIKE '%Migrado de Pos.zip%'
    AND (v_doc.stock_posted OR v_doc.migration_batch_id IS NULL);
  v_old_customer:=v_doc.customer_id;
  v_name:=COALESCE(NULLIF(TRIM(p_client_name),''),'Cliente Pontual');
  v_nuit:=COALESCE(NULLIF(TRIM(p_client_nuit),''),'N/A');
  v_address:=COALESCE(NULLIF(TRIM(p_client_address),''),'N/A');
  v_user_notes:=regexp_replace(COALESCE(p_notes,''),'^\s*\[CLIENTE:[^\]]*\]\s*','','i');
  v_new_customer:=public.resolve_or_create_operational_customer_v2(v_doc.customer_id,v_name,v_nuit,v_address,p_keep_as_walk_in);

  SELECT jsonb_build_object('document',to_jsonb(d),'lines',COALESCE(jsonb_agg(to_jsonb(dl) ORDER BY dl.line_number) FILTER(WHERE dl.id IS NOT NULL),'[]'::jsonb))
  INTO v_old_snapshot FROM public.documents d LEFT JOIN public.document_lines dl ON dl.document_id=d.id
  WHERE d.id=p_document_id GROUP BY d.id;

  IF p_lines IS NOT NULL THEN
    IF v_manage_stock THEN
      FOR v_move IN
        SELECT sm.product_id,sm.warehouse_id,
               SUM(sm.quantity_out-sm.quantity_in) AS quantity_to_restore,
               COALESCE(MAX(sm.unit_cost),0) AS unit_cost
        FROM public.stock_movements sm
        WHERE sm.source_document_id=p_document_id
        GROUP BY sm.product_id,sm.warehouse_id
        HAVING SUM(sm.quantity_out-sm.quantity_in)>0
      LOOP
        PERFORM public.post_stock_movement(
          v_doc.company_id,v_move.product_id,v_move.warehouse_id,'reversal',
          v_move.quantity_to_restore,0,v_move.unit_cost,p_document_id,NULL,NULL,
          v_old_customer,NULL,'Reversão consolidada antes da edição de '||v_doc.display_number,NULL
        );
      END LOOP;
    END IF;

    PERFORM private.replace_document_lines_v2(p_document_id,v_doc.company_id,p_lines,p_general_discount);

    IF v_manage_stock THEN
      FOR v_line IN SELECT * FROM public.document_lines
        WHERE document_id=p_document_id AND stock_effect_enabled AND product_id IS NOT NULL
        ORDER BY line_number
      LOOP
        PERFORM public.post_stock_movement(
          v_doc.company_id,v_line.product_id,v_doc.warehouse_id,'sales_exit',0,v_line.quantity,
          COALESCE(v_line.unit_cost_snapshot,0),p_document_id,v_line.id,NULL,v_new_customer,NULL,
          'Saída após edição de '||v_doc.display_number,NULL
        );
      END LOOP;
    END IF;
  END IF;

  SELECT grand_total INTO v_new_total FROM public.documents WHERE id=p_document_id;
  IF v_type.code='CASH_SALE' THEN
    v_new_paid:=v_new_total; v_new_outstanding:=0;
  ELSIF NOT v_type.affects_customer_account THEN
    v_new_paid:=0; v_new_outstanding:=0;
  ELSE
    IF v_new_total<v_doc.amount_paid THEN RAISE EXCEPTION 'DOCUMENT_TOTAL_BELOW_AMOUNT_ALREADY_PAID: %',v_doc.amount_paid; END IF;
    v_new_paid:=v_doc.amount_paid;
    v_new_outstanding:=CASE WHEN v_type.code='CUSTOMER_CREDIT_NOTE' THEN 0 ELSE GREATEST(v_new_total-v_new_paid,0) END;
  END IF;

  UPDATE public.documents SET customer_id=v_new_customer,
    notes=TRIM(CONCAT('[CLIENTE: ',v_name,' | NUIT: ',v_nuit,' | MORADA: ',v_address,'] ',TRIM(v_user_notes))),
    amount_paid=v_new_paid,outstanding_amount=v_new_outstanding,
    stock_posted=CASE WHEN v_manage_stock THEN EXISTS(SELECT 1 FROM public.document_lines dl WHERE dl.document_id=p_document_id AND dl.stock_effect_enabled AND dl.product_id IS NOT NULL) ELSE stock_posted END,
    updated_by=auth.uid(),updated_at=now()
  WHERE id=p_document_id;

  IF v_type.affects_customer_account AND v_doc.financial_posted THEN
    UPDATE public.ledger_entries SET customer_id=v_new_customer,
      debit_amount=CASE WHEN v_type.code IN('CUSTOMER_INVOICE','CUSTOMER_DEBIT_NOTE','CASH_SALE') THEN v_new_total ELSE 0 END,
      credit_amount=CASE WHEN v_type.code IN('CUSTOMER_CREDIT_NOTE','CASH_SALE') THEN v_new_total ELSE 0 END,
      outstanding_amount=v_new_outstanding
    WHERE source_document_id=p_document_id AND status<>'REVERSED';
    IF v_old_customer IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_old_customer); END IF;
    IF v_new_customer IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_new_customer); END IF;
  END IF;

  SELECT jsonb_build_object('document',to_jsonb(d),'lines',COALESCE(jsonb_agg(to_jsonb(dl) ORDER BY dl.line_number) FILTER(WHERE dl.id IS NOT NULL),'[]'::jsonb))
  INTO v_new_snapshot FROM public.documents d LEFT JOIN public.document_lines dl ON dl.document_id=d.id
  WHERE d.id=p_document_id GROUP BY d.id;
  INSERT INTO audit.operational_events(company_id,user_id,branch_id,warehouse_id,event_type,resource_type,resource_id,reason,metadata)
  VALUES(v_doc.company_id,auth.uid(),v_doc.branch_id,v_doc.warehouse_id,'document.edited','document',p_document_id,
    NULLIF(TRIM(v_user_notes),''),jsonb_build_object('before',v_old_snapshot,'after',v_new_snapshot));
END;
$$;

REVOKE ALL ON FUNCTION public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN) TO authenticated;

-- Administrators cancel issued documents. Physical deletion is intentionally not
-- exposed: the fiscal number and audit trail remain available.
CREATE OR REPLACE FUNCTION public.admin_cancel_operational_document_v2(
  p_document_id UUID,p_reason TEXT,p_idempotency_key UUID
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
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('settings.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED: settings.manage'; END IF;
  IF NULLIF(TRIM(p_reason),'') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED'; END IF;

  SELECT * INTO v_doc FROM public.documents
  WHERE id=p_document_id AND company_id=public.get_user_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF v_doc.status IN('CANCELLED','REVERSED') THEN RETURN true; END IF;
  IF v_doc.status NOT IN('CONFIRMED','PAID','PARTIALLY_PAID','OVERDUE') THEN RAISE EXCEPTION 'DOCUMENT_CANNOT_BE_CANCELLED_IN_STATUS_%',v_doc.status; END IF;

  SELECT * INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  IF v_type.code NOT IN('CUSTOMER_INVOICE','CASH_SALE','CUSTOMER_DELIVERY_NOTE','CUSTOMER_QUOTATION','QUOTATION','COT') THEN
    RAISE EXCEPTION 'UNSUPPORTED_DOCUMENT_TYPE_%',v_type.code;
  END IF;

  IF v_type.affects_stock
     AND COALESCE(v_doc.notes,'') NOT ILIKE '%Migrado de Pos.zip%'
     AND (v_doc.stock_posted OR v_doc.migration_batch_id IS NULL) THEN
    FOR v_move IN
      SELECT sm.product_id,sm.warehouse_id,SUM(sm.quantity_out-sm.quantity_in) AS quantity_to_restore,COALESCE(MAX(sm.unit_cost),0) AS unit_cost
      FROM public.stock_movements sm WHERE sm.source_document_id=p_document_id
      GROUP BY sm.product_id,sm.warehouse_id HAVING SUM(sm.quantity_out-sm.quantity_in)>0
    LOOP
      PERFORM public.post_stock_movement(v_doc.company_id,v_move.product_id,v_move.warehouse_id,'reversal',
        v_move.quantity_to_restore,0,v_move.unit_cost,v_doc.id,NULL,NULL,v_doc.customer_id,v_doc.supplier_id,
        'Anulação administrativa de '||v_doc.display_number||': '||TRIM(p_reason),NULL);
    END LOOP;
  END IF;

  UPDATE public.ledger_entries SET status='REVERSED',outstanding_amount=0
  WHERE source_document_id=v_doc.id AND status<>'REVERSED';
  INSERT INTO public.document_status_history(company_id,document_id,previous_status,new_status,reason,changed_by)
  VALUES(v_doc.company_id,v_doc.id,v_doc.status,'REVERSED',TRIM(p_reason),auth.uid());
  UPDATE public.documents SET status='REVERSED',outstanding_amount=0,stock_posted=false,financial_posted=false,
    cancellation_reason=TRIM(p_reason),cancelled_by=auth.uid(),cancelled_at=now(),updated_by=auth.uid(),updated_at=now()
  WHERE id=v_doc.id;
  IF v_doc.customer_id IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_doc.customer_id); END IF;
  INSERT INTO audit.operational_events(company_id,user_id,branch_id,warehouse_id,event_type,resource_type,resource_id,reason,metadata)
  VALUES(v_doc.company_id,auth.uid(),v_doc.branch_id,v_doc.warehouse_id,'document.cancelled','document',v_doc.id,
    TRIM(p_reason),jsonb_build_object('display_number',v_doc.display_number,'previous_status',v_doc.status,'idempotency_key',p_idempotency_key));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_operational_document_v2(UUID,TEXT,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_operational_document_v2(UUID,TEXT,UUID) TO authenticated;

-- Existing imports contain three old collisions. A trigger protects every new
-- number without forcing an unsafe rewrite of those historical documents.
CREATE OR REPLACE FUNCTION private.prevent_duplicate_active_display_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.display_number IS NULL OR TRIM(NEW.display_number)='' OR NEW.status IN('DRAFT','CANCELLED','REVERSED') THEN
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE'
     AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
     AND NEW.document_type_id IS NOT DISTINCT FROM OLD.document_type_id
     AND UPPER(TRIM(NEW.display_number))=UPPER(TRIM(COALESCE(OLD.display_number,'')))
     AND OLD.status NOT IN('DRAFT','CANCELLED','REVERSED') THEN
    RETURN NEW;
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.documents d
    WHERE d.company_id=NEW.company_id
      AND d.document_type_id=NEW.document_type_id
      AND UPPER(TRIM(d.display_number))=UPPER(TRIM(NEW.display_number))
      AND d.status NOT IN('DRAFT','CANCELLED','REVERSED')
      AND d.id<>NEW.id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_DOCUMENT_NUMBER: %',NEW.display_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_active_display_number ON public.documents;
CREATE TRIGGER trg_prevent_duplicate_active_display_number
BEFORE INSERT OR UPDATE OF company_id,document_type_id,display_number,status ON public.documents
FOR EACH ROW EXECUTE FUNCTION private.prevent_duplicate_active_display_number();

-- One historical VD was edited before stock reversal was made resilient. Its
-- 26 original line rows had already been replaced, leaving 52 orphaned exits.
-- Add immutable counter-movements once; do not delete stock history.
DO $$
DECLARE
  v_document_id CONSTANT UUID := 'c6929b7a-b7c9-475c-aa2a-1fca9d594e66';
  v_doc public.documents;
  v_move RECORD;
  v_repair_marker CONSTANT TEXT := 'Correção das saídas órfãs da edição de CASH_SALE A/000001';
BEGIN
  SELECT * INTO v_doc FROM public.documents
  WHERE id=v_document_id AND display_number='CASH_SALE A/000001' FOR UPDATE;
  IF FOUND AND NOT EXISTS(
    SELECT 1 FROM public.stock_movements WHERE source_document_id=v_document_id AND legacy_ref=v_repair_marker
  ) THEN
    FOR v_move IN
      SELECT sm.product_id,sm.warehouse_id,SUM(sm.quantity_out-sm.quantity_in) AS quantity_to_restore,COALESCE(MAX(sm.unit_cost),0) AS unit_cost
      FROM public.stock_movements sm
      LEFT JOIN public.document_lines dl ON dl.id=sm.source_document_line_id
      WHERE sm.source_document_id=v_document_id AND dl.id IS NULL AND sm.legacy_ref IS NULL
      GROUP BY sm.product_id,sm.warehouse_id
      HAVING SUM(sm.quantity_out-sm.quantity_in)>0
    LOOP
      PERFORM public.post_stock_movement(v_doc.company_id,v_move.product_id,v_move.warehouse_id,'reversal',
        v_move.quantity_to_restore,0,v_move.unit_cost,v_document_id,NULL,NULL,v_doc.customer_id,NULL,v_repair_marker,NULL);
    END LOOP;
  END IF;
END;
$$;

COMMIT;
