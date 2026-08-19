-- Permit changing the issue date of any editable operational document without
-- changing its fiscal number. The fiscal period, due date and ledger dates move
-- together, while stock movement timestamps remain immutable audit evidence.

BEGIN;

DROP FUNCTION IF EXISTS public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN);

CREATE OR REPLACE FUNCTION public.update_operational_document_v2(
  p_document_id UUID,
  p_client_name TEXT DEFAULT NULL,
  p_client_nuit TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL,
  p_grand_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT NULL,
  p_general_discount NUMERIC DEFAULT 0,
  p_keep_as_walk_in BOOLEAN DEFAULT false,
  p_document_date DATE DEFAULT NULL
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
  v_new_document_date DATE;
  v_new_due_date DATE;
  v_new_fiscal_period_id UUID;
  v_current_customer_name TEXT;
  v_current_customer_nuit TEXT;
  v_current_customer_address TEXT;
BEGIN
  SELECT * INTO v_doc FROM public.documents
  WHERE id=p_document_id AND company_id=public.get_user_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF auth.uid() IS NULL OR NOT (
    public.has_permission('sales.create')
    OR public.has_permission('purchases.invoice.create')
    OR public.has_permission('purchases.read')
    OR public.has_permission('settings.manage')
  ) THEN RAISE EXCEPTION 'PERMISSION_DENIED: document.edit'; END IF;

  SELECT * INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  IF v_doc.status IN('CANCELLED','REVERSED') THEN
    RAISE EXCEPTION 'DOCUMENT_CANNOT_BE_EDITED_IN_STATUS_%',v_doc.status;
  END IF;

  v_new_document_date:=COALESCE(p_document_date,v_doc.document_date);
  IF v_new_document_date IS NULL THEN RAISE EXCEPTION 'DOCUMENT_DATE_REQUIRED'; END IF;
  SELECT id INTO v_new_fiscal_period_id
  FROM public.fiscal_periods
  WHERE company_id=v_doc.company_id
    AND v_new_document_date BETWEEN start_date AND end_date
    AND status='open'
  ORDER BY start_date DESC LIMIT 1;
  IF v_new_fiscal_period_id IS NULL THEN
    RAISE EXCEPTION 'NO_OPEN_FISCAL_PERIOD_FOR_DATE_%',v_new_document_date;
  END IF;
  v_new_due_date:=CASE
    WHEN v_doc.due_date IS NULL THEN NULL
    ELSE v_new_document_date + GREATEST(v_doc.due_date-v_doc.document_date,0)
  END;

  v_manage_stock:=v_type.affects_stock
    AND COALESCE(v_doc.notes,'') NOT ILIKE '%Migrado de Pos.zip%'
    AND (v_doc.stock_posted OR v_doc.migration_batch_id IS NULL);
  v_old_customer:=v_doc.customer_id;
  IF v_doc.customer_id IS NOT NULL THEN
    SELECT c.name,c.tax_number,ca.address_line_1
    INTO v_current_customer_name,v_current_customer_nuit,v_current_customer_address
    FROM public.customers c
    LEFT JOIN LATERAL (
      SELECT address_line_1 FROM public.customer_addresses
      WHERE customer_id=c.id AND active ORDER BY is_primary DESC,created_at LIMIT 1
    ) ca ON true
    WHERE c.id=v_doc.customer_id;
  END IF;
  v_name:=COALESCE(NULLIF(TRIM(p_client_name),''),NULLIF(TRIM(v_current_customer_name),''),'Cliente Pontual');
  v_nuit:=COALESCE(NULLIF(TRIM(p_client_nuit),''),NULLIF(TRIM(v_current_customer_nuit),''),'N/A');
  v_address:=COALESCE(NULLIF(TRIM(p_client_address),''),NULLIF(TRIM(v_current_customer_address),''),'N/A');
  v_user_notes:=regexp_replace(COALESCE(p_notes,v_doc.notes,''),'^\s*\[CLIENTE:[^\]]*\]\s*','','i');
  v_new_customer:=CASE
    WHEN v_type.party_type='SUPPLIER' THEN NULL
    WHEN p_client_name IS NULL AND p_client_nuit IS NULL AND p_client_address IS NULL AND NOT p_keep_as_walk_in THEN v_doc.customer_id
    ELSE public.resolve_or_create_operational_customer_v2(v_doc.customer_id,v_name,v_nuit,v_address,p_keep_as_walk_in)
  END;

  SELECT jsonb_build_object('document',to_jsonb(d),'lines',COALESCE(jsonb_agg(to_jsonb(dl) ORDER BY dl.line_number) FILTER(WHERE dl.id IS NOT NULL),'[]'::jsonb))
  INTO v_old_snapshot FROM public.documents d LEFT JOIN public.document_lines dl ON dl.document_id=d.id
  WHERE d.id=p_document_id GROUP BY d.id;

  IF p_lines IS NOT NULL THEN
    IF v_manage_stock THEN
      FOR v_move IN
        SELECT sm.product_id,sm.warehouse_id,SUM(sm.quantity_in-sm.quantity_out) AS net_effect,COALESCE(MAX(sm.unit_cost),0) AS unit_cost
        FROM public.stock_movements sm WHERE sm.source_document_id=p_document_id
        GROUP BY sm.product_id,sm.warehouse_id HAVING SUM(sm.quantity_in-sm.quantity_out)<>0
      LOOP
        PERFORM public.post_stock_movement(v_doc.company_id,v_move.product_id,v_move.warehouse_id,'reversal',
          GREATEST(-v_move.net_effect,0),GREATEST(v_move.net_effect,0),v_move.unit_cost,p_document_id,NULL,NULL,
          v_old_customer,v_doc.supplier_id,
          'Reversão consolidada antes da edição de '||v_doc.display_number,NULL);
      END LOOP;
    END IF;

    PERFORM private.replace_document_lines_v2(p_document_id,v_doc.company_id,p_lines,p_general_discount);

    IF v_manage_stock THEN
      FOR v_line IN SELECT * FROM public.document_lines
        WHERE document_id=p_document_id AND stock_effect_enabled AND product_id IS NOT NULL ORDER BY line_number
      LOOP
        PERFORM public.post_stock_movement(
          v_doc.company_id,v_line.product_id,v_doc.warehouse_id,
          CASE WHEN v_type.stock_direction='IN' THEN 'purchase_entry' ELSE 'sales_exit' END,
          CASE WHEN v_type.stock_direction='IN' THEN v_line.quantity ELSE 0 END,
          CASE WHEN v_type.stock_direction='OUT' THEN v_line.quantity ELSE 0 END,
          COALESCE(v_line.unit_cost_snapshot,0),p_document_id,v_line.id,NULL,
          CASE WHEN v_type.party_type='CUSTOMER' THEN v_new_customer END,
          CASE WHEN v_type.party_type='SUPPLIER' THEN v_doc.supplier_id END,
          CASE WHEN v_type.stock_direction='IN' THEN 'Entrada após edição de ' ELSE 'Saída após edição de ' END||v_doc.display_number,NULL
        );
      END LOOP;
    END IF;
  END IF;

  SELECT grand_total INTO v_new_total FROM public.documents WHERE id=p_document_id;
  IF v_type.code='CASH_SALE' THEN v_new_paid:=v_new_total; v_new_outstanding:=0;
  ELSIF NOT v_type.affects_customer_account AND NOT v_type.affects_supplier_account THEN v_new_paid:=0; v_new_outstanding:=0;
  ELSE
    IF v_new_total<v_doc.amount_paid THEN RAISE EXCEPTION 'DOCUMENT_TOTAL_BELOW_AMOUNT_ALREADY_PAID: %',v_doc.amount_paid; END IF;
    v_new_paid:=v_doc.amount_paid;
    v_new_outstanding:=CASE WHEN v_type.code IN('CUSTOMER_CREDIT_NOTE','SUPPLIER_CREDIT_ADVICE','SUPPLIER_CREDIT_NOTE') THEN 0 ELSE GREATEST(v_new_total-v_new_paid,0) END;
  END IF;

  UPDATE public.documents SET
    customer_id=CASE WHEN supplier_id IS NOT NULL THEN customer_id ELSE v_new_customer END,
    document_date=v_new_document_date,due_date=v_new_due_date,fiscal_period_id=v_new_fiscal_period_id,
    notes=CASE WHEN p_notes IS NULL AND p_client_name IS NULL AND p_client_nuit IS NULL AND p_client_address IS NULL THEN notes
      WHEN supplier_id IS NOT NULL THEN COALESCE(NULLIF(TRIM(p_notes),''),notes)
      ELSE TRIM(CONCAT('[CLIENTE: ',v_name,' | NUIT: ',v_nuit,' | MORADA: ',v_address,'] ',TRIM(v_user_notes))) END,
    amount_paid=v_new_paid,outstanding_amount=v_new_outstanding,
    stock_posted=CASE WHEN v_manage_stock THEN EXISTS(SELECT 1 FROM public.document_lines dl WHERE dl.document_id=p_document_id AND dl.stock_effect_enabled AND dl.product_id IS NOT NULL) ELSE stock_posted END,
    updated_by=auth.uid(),updated_at=now()
  WHERE id=p_document_id;

  IF v_doc.financial_posted THEN
    UPDATE public.ledger_entries SET
      customer_id=CASE WHEN party_type='CUSTOMER' THEN v_new_customer ELSE customer_id END,
      entry_date=v_new_document_date,due_date=v_new_due_date,
      debit_amount=CASE WHEN debit_amount>0 THEN v_new_total ELSE 0 END,
      credit_amount=CASE WHEN credit_amount>0 THEN v_new_total ELSE 0 END,
      outstanding_amount=v_new_outstanding
    WHERE source_document_id=p_document_id AND status<>'REVERSED';
    IF v_old_customer IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_old_customer); END IF;
    IF v_new_customer IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_new_customer); END IF;
    IF v_doc.supplier_id IS NOT NULL THEN PERFORM private.refresh_supplier_balance(v_doc.supplier_id); END IF;
  END IF;

  SELECT jsonb_build_object('document',to_jsonb(d),'lines',COALESCE(jsonb_agg(to_jsonb(dl) ORDER BY dl.line_number) FILTER(WHERE dl.id IS NOT NULL),'[]'::jsonb))
  INTO v_new_snapshot FROM public.documents d LEFT JOIN public.document_lines dl ON dl.document_id=d.id
  WHERE d.id=p_document_id GROUP BY d.id;
  INSERT INTO audit.operational_events(company_id,user_id,branch_id,warehouse_id,event_type,resource_type,resource_id,reason,metadata)
  VALUES(v_doc.company_id,auth.uid(),v_doc.branch_id,v_doc.warehouse_id,'document.edited','document',p_document_id,
    NULLIF(TRIM(v_user_notes),''),jsonb_build_object('before',v_old_snapshot,'after',v_new_snapshot));
END;
$$;

REVOKE ALL ON FUNCTION public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN,DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN,DATE) TO authenticated;

COMMIT;
