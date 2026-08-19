BEGIN;

-- Preserve the independent atomic sequences while always presenting the familiar
-- Portuguese commercial prefixes. This replaces an older deployed formatter that
-- returned values such as "CASH_SALE A/000002".
CREATE OR REPLACE FUNCTION private.confirm_customer_document(
  p_document_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_doc public.documents;
  v_doc_type public.document_types;
  v_next_num BIGINT;
  v_prefix TEXT;
  v_display_num TEXT;
  v_line RECORD;
  v_new_bal NUMERIC(18,2);
  v_stock_posted BOOLEAN := false;
BEGIN
  SELECT * INTO v_doc FROM public.documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: %', p_document_id; END IF;
  IF v_doc.status <> 'DRAFT' THEN
    IF v_doc.idempotency_key IS NOT NULL AND v_doc.idempotency_key=p_idempotency_key THEN RETURN v_doc; END IF;
    RAISE EXCEPTION 'INVALID_STATUS: Document % is already %.',p_document_id,v_doc.status;
  END IF;
  SELECT * INTO v_doc_type FROM public.document_types WHERE id=v_doc.document_type_id;
  PERFORM public.recalculate_document(p_document_id);
  SELECT * INTO v_doc FROM public.documents WHERE id=p_document_id;
  v_next_num := private.next_document_number(v_doc.company_id,v_doc.document_type_id,v_doc.fiscal_period_id,v_doc.series);
  v_prefix := CASE v_doc_type.code
    WHEN 'CUSTOMER_INVOICE' THEN 'FT'
    WHEN 'CASH_SALE' THEN 'VD'
    WHEN 'CUSTOMER_DELIVERY_NOTE' THEN 'GR'
    WHEN 'CUSTOMER_QUOTATION' THEN 'COT'
    WHEN 'QUOTATION' THEN 'COT'
    WHEN 'COT' THEN 'COT'
    WHEN 'CUSTOMER_CREDIT_NOTE' THEN 'NC'
    WHEN 'CUSTOMER_DEBIT_NOTE' THEN 'ND'
    ELSE v_doc_type.code
  END;
  v_display_num := v_prefix||'-'||TO_CHAR(v_doc.document_date,'YYYY')||'/'||
    LPAD(v_next_num::TEXT,CASE WHEN v_prefix='COT' THEN 3 ELSE 6 END,'0');

  FOR v_line IN SELECT * FROM public.document_lines WHERE document_id=p_document_id LOOP
    IF v_line.stock_effect_enabled AND v_line.product_id IS NOT NULL AND NOT v_doc.stock_posted THEN
      IF v_doc_type.stock_direction='OUT' THEN
        PERFORM public.post_stock_movement(
          p_company_id:=v_doc.company_id,p_product_id:=v_line.product_id,p_warehouse_id:=v_doc.warehouse_id,
          p_movement_type:='sales_exit',p_quantity_in:=0,p_quantity_out:=v_line.quantity,
          p_unit_cost:=COALESCE(v_line.unit_cost_snapshot,0),p_source_document_id:=v_doc.id,
          p_source_document_line_id:=v_line.id,p_customer_id:=v_doc.customer_id
        );
        v_stock_posted:=true;
      ELSIF v_doc_type.stock_direction='IN' THEN
        PERFORM public.post_stock_movement(
          p_company_id:=v_doc.company_id,p_product_id:=v_line.product_id,p_warehouse_id:=v_doc.warehouse_id,
          p_movement_type:='customer_return',p_quantity_in:=v_line.quantity,p_quantity_out:=0,
          p_unit_cost:=COALESCE(v_line.unit_cost_snapshot,0),p_source_document_id:=v_doc.id,
          p_source_document_line_id:=v_line.id,p_customer_id:=v_doc.customer_id
        );
        v_stock_posted:=true;
      END IF;
    END IF;
  END LOOP;

  IF v_doc_type.affects_customer_account AND NOT v_doc.financial_posted AND v_doc.customer_id IS NOT NULL THEN
    INSERT INTO public.ledger_entries(
      company_id,branch_id,party_type,customer_id,entry_date,due_date,entry_type,
      debit_amount,credit_amount,outstanding_amount,source_document_id,status,created_by
    ) VALUES(
      v_doc.company_id,v_doc.branch_id,'CUSTOMER',v_doc.customer_id,v_doc.document_date,v_doc.due_date,v_doc_type.code,
      CASE WHEN v_doc_type.code IN('CUSTOMER_INVOICE','CASH_SALE','CUSTOMER_DEBIT_NOTE') THEN v_doc.grand_total ELSE 0 END,
      CASE WHEN v_doc_type.code='CUSTOMER_CREDIT_NOTE' THEN v_doc.grand_total ELSE 0 END,
      v_doc.grand_total,v_doc.id,'CONFIRMED',COALESCE(auth.uid(),v_doc.created_by)
    );
    SELECT COALESCE(SUM(debit_amount-credit_amount),0) INTO v_new_bal
    FROM public.ledger_entries WHERE customer_id=v_doc.customer_id AND status='CONFIRMED';
    UPDATE public.customers SET current_balance=v_new_bal,updated_at=now() WHERE id=v_doc.customer_id;
  END IF;

  INSERT INTO public.document_status_history(company_id,document_id,previous_status,new_status,reason,changed_by)
  VALUES(v_doc.company_id,v_doc.id,'DRAFT','CONFIRMED','Document confirmation',COALESCE(auth.uid(),v_doc.created_by));
  UPDATE public.documents SET
    status='CONFIRMED',document_number=v_next_num,display_number=v_display_num,
    stock_posted=v_stock_posted OR stock_posted,
    financial_posted=CASE WHEN v_doc_type.affects_customer_account AND customer_id IS NOT NULL THEN true ELSE financial_posted END,
    confirmed_by=COALESCE(auth.uid(),v_doc.created_by),confirmed_at=now(),
    idempotency_key=COALESCE(p_idempotency_key,idempotency_key),updated_at=now()
  WHERE id=p_document_id RETURNING * INTO v_doc;
  RETURN v_doc;
END;
$$;

-- The imported Pos.zip documents do not use migration_batch_id, so classify them by
-- their explicit migration note. Editing those records changes their lines/totals but
-- never posts historical stock retroactively.
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
  v_line RECORD;
  v_name TEXT;
  v_nuit TEXT;
  v_address TEXT;
  v_user_notes TEXT;
  v_manage_stock BOOLEAN := false;
BEGIN
  SELECT * INTO v_doc FROM public.documents WHERE id=p_document_id AND company_id=public.get_user_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF auth.uid() IS NULL OR NOT public.has_permission('sales.create') THEN RAISE EXCEPTION 'PERMISSION_DENIED: sales.create'; END IF;
  SELECT * INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  IF v_doc.status IN('CANCELLED','REVERSED') THEN RAISE EXCEPTION 'DOCUMENT_CANNOT_BE_EDITED_IN_STATUS_%',v_doc.status; END IF;
  v_manage_stock := v_type.affects_stock
    AND COALESCE(v_doc.notes,'') NOT ILIKE '%Migrado de Pos.zip%'
    AND (v_doc.stock_posted OR v_doc.migration_batch_id IS NULL);
  v_old_customer:=v_doc.customer_id;
  v_name:=COALESCE(NULLIF(TRIM(p_client_name),''),'Cliente Pontual');
  v_nuit:=COALESCE(NULLIF(TRIM(p_client_nuit),''),'N/A');
  v_address:=COALESCE(NULLIF(TRIM(p_client_address),''),'N/A');
  v_user_notes:=regexp_replace(COALESCE(p_notes,''),'^\s*\[CLIENTE:[^\]]*\]\s*','','i');
  v_new_customer:=public.resolve_or_create_operational_customer_v2(v_doc.customer_id,v_name,v_nuit,v_address,p_keep_as_walk_in);

  SELECT jsonb_build_object('document',to_jsonb(d),'lines',COALESCE(jsonb_agg(to_jsonb(dl) ORDER BY dl.line_number) FILTER(WHERE dl.id IS NOT NULL),'[]'::jsonb))
  INTO v_old_snapshot FROM public.documents d LEFT JOIN public.document_lines dl ON dl.document_id=d.id WHERE d.id=p_document_id GROUP BY d.id;

  IF p_lines IS NOT NULL THEN
    IF v_manage_stock THEN
      FOR v_line IN SELECT * FROM public.document_lines WHERE document_id=p_document_id AND stock_effect_enabled AND product_id IS NOT NULL ORDER BY line_number LOOP
        PERFORM public.post_stock_movement(v_doc.company_id,v_line.product_id,v_doc.warehouse_id,'reversal',v_line.quantity,0,
          COALESCE(v_line.unit_cost_snapshot,0),p_document_id,v_line.id,NULL,v_old_customer,NULL,
          'Reversão por edição de '||v_doc.display_number,NULL);
      END LOOP;
    END IF;
    PERFORM private.replace_document_lines_v2(p_document_id,v_doc.company_id,p_lines,p_general_discount);
    IF v_manage_stock THEN
      FOR v_line IN SELECT * FROM public.document_lines WHERE document_id=p_document_id AND stock_effect_enabled AND product_id IS NOT NULL LOOP
        PERFORM public.post_stock_movement(v_doc.company_id,v_line.product_id,v_doc.warehouse_id,'sales_exit',0,v_line.quantity,
          COALESCE(v_line.unit_cost_snapshot,0),p_document_id,v_line.id,NULL,v_new_customer,NULL,
          'Reposição após edição de '||v_doc.display_number,NULL);
      END LOOP;
    END IF;
  END IF;
  IF (SELECT grand_total FROM public.documents WHERE id=p_document_id)<v_doc.amount_paid THEN
    RAISE EXCEPTION 'DOCUMENT_TOTAL_BELOW_AMOUNT_ALREADY_PAID: %',v_doc.amount_paid;
  END IF;
  UPDATE public.documents SET customer_id=v_new_customer,
    notes=TRIM(CONCAT('[CLIENTE: ',v_name,' | NUIT: ',v_nuit,' | MORADA: ',v_address,'] ',TRIM(v_user_notes))),
    outstanding_amount=GREATEST(grand_total-amount_paid,0),
    stock_posted=CASE WHEN v_manage_stock THEN EXISTS(SELECT 1 FROM public.document_lines dl WHERE dl.document_id=p_document_id AND dl.stock_effect_enabled AND dl.product_id IS NOT NULL) ELSE stock_posted END,
    updated_by=auth.uid(),updated_at=now()
  WHERE id=p_document_id;
  IF v_type.affects_customer_account AND v_doc.financial_posted THEN
    UPDATE public.ledger_entries SET customer_id=v_new_customer,
      debit_amount=CASE WHEN debit_amount>0 THEN (SELECT grand_total FROM public.documents WHERE id=p_document_id) ELSE debit_amount END,
      credit_amount=CASE WHEN credit_amount>0 THEN (SELECT grand_total FROM public.documents WHERE id=p_document_id) ELSE credit_amount END,
      outstanding_amount=(SELECT outstanding_amount FROM public.documents WHERE id=p_document_id)
    WHERE source_document_id=p_document_id AND status<>'REVERSED';
    IF v_old_customer IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_old_customer); END IF;
    IF v_new_customer IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_new_customer); END IF;
  END IF;
  SELECT jsonb_build_object('document',to_jsonb(d),'lines',COALESCE(jsonb_agg(to_jsonb(dl) ORDER BY dl.line_number) FILTER(WHERE dl.id IS NOT NULL),'[]'::jsonb))
  INTO v_new_snapshot FROM public.documents d LEFT JOIN public.document_lines dl ON dl.document_id=d.id WHERE d.id=p_document_id GROUP BY d.id;
  INSERT INTO audit.operational_events(company_id,user_id,branch_id,warehouse_id,event_type,resource_type,resource_id,reason,metadata)
  VALUES(v_doc.company_id,auth.uid(),v_doc.branch_id,v_doc.warehouse_id,'document.edited','document',p_document_id,
    NULLIF(TRIM(v_user_notes),''),jsonb_build_object('before',v_old_snapshot,'after',v_new_snapshot));
END;
$$;

REVOKE ALL ON FUNCTION public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN) TO authenticated;

COMMIT;
