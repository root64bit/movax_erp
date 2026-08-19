-- Manual stock guides: atomic stock posting, optional supplier cost credit,
-- optional catalogue sale-price update, editing, printing and safe cancellation.

BEGIN;

INSERT INTO public.document_types(
  company_id,code,name,direction,party_type,affects_stock,stock_direction,
  affects_customer_account,affects_supplier_account,requires_customer,requires_supplier,
  requires_source_document,allows_manual_price,allows_discount,active
)
SELECT c.id,'STOCK_ENTRY_GUIDE','Guia de Entrada de Stock','INTERNAL','SUPPLIER',true,'IN',false,true,false,false,false,true,false,true
FROM public.companies c
ON CONFLICT(company_id,code) DO UPDATE SET
  name=EXCLUDED.name,direction=EXCLUDED.direction,party_type=EXCLUDED.party_type,
  affects_stock=true,stock_direction='IN',affects_supplier_account=true,
  requires_supplier=false,allows_manual_price=true,active=true;

INSERT INTO public.document_types(
  company_id,code,name,direction,party_type,affects_stock,stock_direction,
  affects_customer_account,affects_supplier_account,requires_customer,requires_supplier,
  requires_source_document,allows_manual_price,allows_discount,active
)
SELECT c.id,'STOCK_EXIT_GUIDE','Guia de Saída de Stock','INTERNAL','NONE',true,'OUT',false,false,false,false,false,true,false,true
FROM public.companies c
ON CONFLICT(company_id,code) DO UPDATE SET
  name=EXCLUDED.name,direction=EXCLUDED.direction,party_type=EXCLUDED.party_type,
  affects_stock=true,stock_direction='OUT',affects_supplier_account=false,
  requires_supplier=false,allows_manual_price=true,active=true;

CREATE TABLE IF NOT EXISTS public.stock_guide_line_details(
  document_line_id UUID PRIMARY KEY REFERENCES public.document_lines(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  cost_was_provided BOOLEAN NOT NULL DEFAULT false,
  sale_price_incl NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(sale_price_incl IS NULL OR sale_price_incl>=0)
);
ALTER TABLE public.stock_guide_line_details ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.stock_guide_line_details TO authenticated;
GRANT ALL ON public.stock_guide_line_details TO service_role;
DROP POLICY IF EXISTS stock_guide_line_details_select ON public.stock_guide_line_details;
CREATE POLICY stock_guide_line_details_select ON public.stock_guide_line_details
  FOR SELECT TO authenticated USING(company_id=public.get_user_company_id());

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_manual_stock_guide_reference
ON public.documents(
  company_id,document_type_id,LOWER(TRIM(external_reference)),COALESCE(supplier_id,'00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE external_reference IS NOT NULL AND series='MANUAL' AND status NOT IN('CANCELLED','REVERSED');

CREATE OR REPLACE FUNCTION private.apply_stock_guide_lines_v2(
  p_document_id UUID,p_company_id UUID,p_warehouse_id UUID,p_direction TEXT,
  p_supplier_id UUID,p_items JSONB
)
RETURNS NUMERIC(18,2)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
DECLARE
  v_item JSONB; v_product public.products; v_line_id UUID; v_line_no INT:=0;
  v_qty NUMERIC(18,3); v_cost NUMERIC(18,4); v_stock_cost NUMERIC(18,4);
  v_sale NUMERIC(15,2); v_total NUMERIC(18,2):=0; v_line_total NUMERIC(18,2);
  v_tax_rate NUMERIC(9,4); v_old_excl NUMERIC(15,2); v_new_excl NUMERIC(15,2);
  v_cost_provided BOOLEAN;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN
    RAISE EXCEPTION 'STOCK_GUIDE_LINES_REQUIRED';
  END IF;
  IF jsonb_array_length(p_items)>99 THEN RAISE EXCEPTION 'STOCK_GUIDE_MAX_99_LINES'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_line_no:=v_line_no+1;
    v_qty:=COALESCE(NULLIF(v_item->>'quantity','')::NUMERIC,0);
    v_cost_provided:=NULLIF(v_item->>'unit_cost','') IS NOT NULL;
    v_cost:=COALESCE(NULLIF(v_item->>'unit_cost','')::NUMERIC,0);
    v_sale:=NULLIF(v_item->>'sale_price_incl','')::NUMERIC;
    IF v_qty<=0 OR v_cost<0 OR COALESCE(v_sale,0)<0 THEN RAISE EXCEPTION 'INVALID_STOCK_GUIDE_LINE_%',v_line_no; END IF;

    SELECT p.* INTO v_product FROM public.products p
    WHERE p.id=(v_item->>'product_id')::UUID AND p.company_id=p_company_id AND p.is_active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND_LINE_%',v_line_no; END IF;

    v_line_total:=ROUND(v_qty*v_cost,2);
    v_total:=v_total+v_line_total;
    INSERT INTO public.document_lines(
      company_id,document_id,line_number,product_id,product_code_snapshot,description_snapshot,
      unit_code_snapshot,quantity,unit_price,discount_percentage,discount_amount,tax_rate_snapshot,
      net_amount,tax_amount,total_amount,unit_cost_snapshot,stock_effect_enabled
    ) VALUES(
      p_company_id,p_document_id,v_line_no,v_product.id,v_product.code,v_product.description,
      'UN',v_qty,v_cost,0,0,0,v_line_total,0,v_line_total,v_cost,true
    ) RETURNING id INTO v_line_id;

    INSERT INTO public.stock_guide_line_details(document_line_id,company_id,cost_was_provided,sale_price_incl)
    VALUES(v_line_id,p_company_id,v_cost_provided,v_sale);

    v_stock_cost:=CASE WHEN v_cost_provided THEN v_cost ELSE COALESCE(v_product.avg_cost,0) END;
    PERFORM public.post_stock_movement(
      p_company_id,v_product.id,p_warehouse_id,
      CASE WHEN p_direction='IN' THEN 'direct_entry' ELSE 'direct_exit' END,
      CASE WHEN p_direction='IN' THEN v_qty ELSE 0 END,
      CASE WHEN p_direction='OUT' THEN v_qty ELSE 0 END,
      v_stock_cost,p_document_id,v_line_id,NULL,NULL,p_supplier_id,
      (SELECT external_reference FROM public.documents WHERE id=p_document_id),NULL
    );

    IF p_direction='IN' AND v_sale IS NOT NULL AND v_sale>0 AND v_sale<>v_product.sale_price_incl THEN
      SELECT COALESCE(tc.rate,0) INTO v_tax_rate FROM public.tax_codes tc WHERE tc.id=v_product.tax_code_id;
      v_tax_rate:=COALESCE(v_tax_rate,0);
      v_old_excl:=v_product.sale_price_excl;
      v_new_excl:=ROUND(v_sale/(1+v_tax_rate/100),2);
      INSERT INTO public.price_history(product_id,field_changed,old_value,new_value,changed_by,reason)
      VALUES(v_product.id,'sale_price_incl',v_product.sale_price_incl,v_sale,auth.uid(),'Atualização pela guia de entrada '||(SELECT external_reference FROM public.documents WHERE id=p_document_id));
      IF v_old_excl<>v_new_excl THEN
        INSERT INTO public.price_history(product_id,field_changed,old_value,new_value,changed_by,reason)
        VALUES(v_product.id,'sale_price_excl',v_old_excl,v_new_excl,auth.uid(),'Atualização pela guia de entrada '||(SELECT external_reference FROM public.documents WHERE id=p_document_id));
      END IF;
      UPDATE public.products SET sale_price_incl=v_sale,sale_price_excl=v_new_excl,updated_by=auth.uid(),updated_at=now()
      WHERE id=v_product.id;
    END IF;
  END LOOP;
  RETURN ROUND(v_total,2);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stock_guide_v2(p_document_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object(
    'id',d.id,'display_number',d.display_number,'external_reference',d.external_reference,
    'document_date',d.document_date,'created_at',d.created_at,'status',d.status,'notes',d.notes,
    'warehouse_id',d.warehouse_id,'supplier_id',d.supplier_id,'supplier_name',s.name,
    'supplier_number',s.supplier_number,'type_code',dt.code,'type_name',dt.name,
    'grand_total',d.grand_total,'amount_paid',d.amount_paid,'outstanding_amount',d.outstanding_amount,
    'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'document_line_id',dl.id,'product_id',dl.product_id,'code',dl.product_code_snapshot,
      'description',dl.description_snapshot,'quantity',dl.quantity,
      'unit_cost',CASE WHEN gd.cost_was_provided THEN dl.unit_cost_snapshot ELSE NULL END,
      'sale_price_incl',gd.sale_price_incl,'total',dl.total_amount
    ) ORDER BY dl.line_number) FROM public.document_lines dl
    LEFT JOIN public.stock_guide_line_details gd ON gd.document_line_id=dl.id WHERE dl.document_id=d.id),'[]'::jsonb)
  )
  FROM public.documents d JOIN public.document_types dt ON dt.id=d.document_type_id
  LEFT JOIN public.suppliers s ON s.id=d.supplier_id
  WHERE d.id=p_document_id AND d.company_id=public.get_user_company_id()
    AND dt.code IN('STOCK_ENTRY_GUIDE','STOCK_EXIT_GUIDE')
    AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.create_stock_guide_v2(
  p_guide_type TEXT,p_guide_number TEXT,p_document_date DATE,p_warehouse_id UUID,
  p_supplier_id UUID,p_notes TEXT,p_items JSONB,p_idempotency_key TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,audit,pg_temp AS $$
DECLARE
  v_company UUID; v_branch UUID; v_period UUID; v_type UUID; v_doc UUID; v_total NUMERIC(18,2);
  v_direction TEXT; v_number TEXT:=NULLIF(TRIM(p_guide_number),''); v_existing UUID;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_guide_type='STOCK_ENTRY_GUIDE' AND NOT(public.has_permission('stock.direct_entry') OR public.has_permission('stock.entry.confirm')) THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.direct_entry'; END IF;
  IF p_guide_type='STOCK_EXIT_GUIDE' AND NOT(public.has_permission('stock.direct_exit') OR public.has_permission('stock.exit.confirm')) THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.direct_exit'; END IF;
  IF p_guide_type NOT IN('STOCK_ENTRY_GUIDE','STOCK_EXIT_GUIDE') THEN RAISE EXCEPTION 'INVALID_STOCK_GUIDE_TYPE'; END IF;
  IF v_number IS NULL THEN RAISE EXCEPTION 'STOCK_GUIDE_NUMBER_REQUIRED'; END IF;
  IF NULLIF(TRIM(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_REQUIRED'; END IF;
  IF p_guide_type='STOCK_EXIT_GUIDE' THEN p_supplier_id:=NULL; END IF;
  v_company:=public.get_user_company_id(); v_direction:=CASE WHEN p_guide_type='STOCK_ENTRY_GUIDE' THEN 'IN' ELSE 'OUT' END;
  SELECT id INTO v_existing FROM public.documents WHERE company_id=v_company AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id=p_warehouse_id AND company_id=v_company AND is_active) THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND'; END IF;
  IF NOT public.has_warehouse_access(p_warehouse_id) AND EXISTS(SELECT 1 FROM public.warehouse_access WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'WAREHOUSE_ACCESS_REQUIRED'; END IF;
  IF p_supplier_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=p_supplier_id AND company_id=v_company AND active) THEN RAISE EXCEPTION 'SUPPLIER_NOT_FOUND'; END IF;
  SELECT id INTO v_period FROM public.fiscal_periods WHERE company_id=v_company AND p_document_date BETWEEN start_date AND end_date AND status='open' ORDER BY start_date DESC LIMIT 1;
  IF v_period IS NULL THEN RAISE EXCEPTION 'NO_OPEN_FISCAL_PERIOD_FOR_DATE_%',p_document_date; END IF;
  SELECT b.id INTO v_branch FROM public.branches b WHERE b.company_id=v_company AND b.is_active AND(public.has_branch_access(b.id) OR NOT EXISTS(SELECT 1 FROM public.branch_access WHERE user_id=auth.uid())) ORDER BY b.code LIMIT 1;
  IF v_branch IS NULL THEN RAISE EXCEPTION 'BRANCH_ACCESS_REQUIRED'; END IF;
  SELECT id INTO v_type FROM public.document_types WHERE company_id=v_company AND code=p_guide_type AND active;

  INSERT INTO public.documents(company_id,branch_id,warehouse_id,document_type_id,fiscal_period_id,series,display_number,
    document_date,due_date,supplier_id,external_reference,supplier_invoice_number,status,subtotal,net_total,tax_total,
    grand_total,amount_paid,outstanding_amount,stock_posted,financial_posted,idempotency_key,notes,created_by,updated_by,confirmed_by,confirmed_at)
  VALUES(v_company,v_branch,p_warehouse_id,v_type,v_period,'MANUAL',v_number,p_document_date,p_document_date,p_supplier_id,
    v_number,CASE WHEN p_supplier_id IS NOT NULL THEN v_number END,'CONFIRMED',0,0,0,0,0,0,false,false,p_idempotency_key,NULLIF(TRIM(p_notes),''),auth.uid(),auth.uid(),auth.uid(),now())
  RETURNING id INTO v_doc;

  v_total:=private.apply_stock_guide_lines_v2(v_doc,v_company,p_warehouse_id,v_direction,p_supplier_id,p_items);
  UPDATE public.documents SET subtotal=v_total,net_total=v_total,grand_total=v_total,
    outstanding_amount=CASE WHEN p_supplier_id IS NOT NULL THEN v_total ELSE 0 END,
    stock_posted=true,financial_posted=(p_supplier_id IS NOT NULL AND v_total>0),updated_at=now() WHERE id=v_doc;
  IF p_supplier_id IS NOT NULL AND v_total>0 THEN
    INSERT INTO public.ledger_entries(company_id,branch_id,party_type,supplier_id,entry_date,due_date,entry_type,
      debit_amount,credit_amount,outstanding_amount,source_document_id,status,created_by)
    VALUES(v_company,v_branch,'SUPPLIER',p_supplier_id,p_document_date,p_document_date,'STOCK_ENTRY_GUIDE',0,v_total,v_total,v_doc,'CONFIRMED',auth.uid());
    PERFORM private.refresh_supplier_balance(p_supplier_id);
  END IF;
  INSERT INTO public.document_status_history(company_id,document_id,previous_status,new_status,reason,changed_by)
  VALUES(v_company,v_doc,'DRAFT','CONFIRMED','Guia manual de stock confirmada',auth.uid());
  INSERT INTO audit.operational_events(company_id,user_id,branch_id,warehouse_id,event_type,resource_type,resource_id,reason,idempotency_key,metadata)
  VALUES(v_company,auth.uid(),v_branch,p_warehouse_id,'stock_guide.created','document',v_doc,NULLIF(TRIM(p_notes),''),p_idempotency_key,
    jsonb_build_object('guide_number',v_number,'type',p_guide_type,'supplier_id',p_supplier_id,'cost_total',v_total));
  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stock_guide_v2(
  p_document_id UUID,p_guide_number TEXT,p_document_date DATE,p_warehouse_id UUID,
  p_supplier_id UUID,p_notes TEXT,p_items JSONB
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,audit,pg_temp AS $$
DECLARE
  v_doc public.documents; v_type public.document_types; v_move RECORD; v_old_supplier UUID;
  v_total NUMERIC(18,2); v_direction TEXT; v_period UUID; v_number TEXT:=NULLIF(TRIM(p_guide_number),'');
  v_ledger public.ledger_entries; v_before JSONB;
BEGIN
  SELECT d.* INTO v_doc FROM public.documents d WHERE d.id=p_document_id AND d.company_id=public.get_user_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_GUIDE_NOT_FOUND'; END IF;
  SELECT * INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  IF v_type.code NOT IN('STOCK_ENTRY_GUIDE','STOCK_EXIT_GUIDE') THEN RAISE EXCEPTION 'INVALID_STOCK_GUIDE'; END IF;
  IF v_doc.status IN('CANCELLED','REVERSED') THEN RAISE EXCEPTION 'CANCELLED_STOCK_GUIDE_CANNOT_BE_EDITED'; END IF;
  IF v_type.code='STOCK_ENTRY_GUIDE' AND NOT(public.has_permission('stock.direct_entry') OR public.has_permission('stock.entry.confirm') OR public.has_permission('settings.manage')) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF v_type.code='STOCK_EXIT_GUIDE' AND NOT(public.has_permission('stock.direct_exit') OR public.has_permission('stock.exit.confirm') OR public.has_permission('settings.manage')) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF v_number IS NULL THEN RAISE EXCEPTION 'STOCK_GUIDE_NUMBER_REQUIRED'; END IF;
  IF v_type.code='STOCK_EXIT_GUIDE' THEN p_supplier_id:=NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.warehouses WHERE id=p_warehouse_id AND company_id=v_doc.company_id AND is_active) THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND'; END IF;
  IF NOT public.has_warehouse_access(p_warehouse_id) AND EXISTS(SELECT 1 FROM public.warehouse_access WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'WAREHOUSE_ACCESS_REQUIRED'; END IF;
  IF p_supplier_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=p_supplier_id AND company_id=v_doc.company_id AND active) THEN RAISE EXCEPTION 'SUPPLIER_NOT_FOUND'; END IF;
  SELECT id INTO v_period FROM public.fiscal_periods WHERE company_id=v_doc.company_id AND p_document_date BETWEEN start_date AND end_date AND status='open' ORDER BY start_date DESC LIMIT 1;
  IF v_period IS NULL THEN RAISE EXCEPTION 'NO_OPEN_FISCAL_PERIOD_FOR_DATE_%',p_document_date; END IF;
  IF v_doc.amount_paid>0 AND p_supplier_id IS DISTINCT FROM v_doc.supplier_id THEN RAISE EXCEPTION 'PAID_STOCK_GUIDE_SUPPLIER_CANNOT_CHANGE'; END IF;
  v_before:=public.get_stock_guide_v2(p_document_id); v_old_supplier:=v_doc.supplier_id;
  v_direction:=CASE WHEN v_type.code='STOCK_ENTRY_GUIDE' THEN 'IN' ELSE 'OUT' END;

  FOR v_move IN SELECT sm.product_id,sm.warehouse_id,SUM(sm.quantity_in-sm.quantity_out) net_effect,COALESCE(MAX(sm.unit_cost),0) unit_cost
    FROM public.stock_movements sm WHERE sm.source_document_id=p_document_id GROUP BY sm.product_id,sm.warehouse_id HAVING SUM(sm.quantity_in-sm.quantity_out)<>0
  LOOP
    PERFORM public.post_stock_movement(v_doc.company_id,v_move.product_id,v_move.warehouse_id,'reversal',
      GREATEST(-v_move.net_effect,0),GREATEST(v_move.net_effect,0),v_move.unit_cost,p_document_id,NULL,NULL,NULL,v_old_supplier,
      'Reversão antes da edição de '||v_doc.display_number,NULL);
  END LOOP;
  DELETE FROM public.document_lines WHERE document_id=p_document_id;
  UPDATE public.documents SET warehouse_id=p_warehouse_id,fiscal_period_id=v_period,display_number=v_number,
    external_reference=v_number,supplier_invoice_number=CASE WHEN p_supplier_id IS NOT NULL THEN v_number END,
    document_date=p_document_date,due_date=p_document_date,supplier_id=p_supplier_id,notes=NULLIF(TRIM(p_notes),''),updated_by=auth.uid(),updated_at=now()
  WHERE id=p_document_id;
  v_total:=private.apply_stock_guide_lines_v2(p_document_id,v_doc.company_id,p_warehouse_id,v_direction,p_supplier_id,p_items);
  IF v_total<v_doc.amount_paid THEN RAISE EXCEPTION 'STOCK_GUIDE_TOTAL_BELOW_AMOUNT_ALREADY_PAID_%',v_doc.amount_paid; END IF;

  SELECT * INTO v_ledger FROM public.ledger_entries WHERE source_document_id=p_document_id AND status='CONFIRMED' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_ledger.id IS NOT NULL AND (p_supplier_id IS NULL OR v_total=0 OR p_supplier_id IS DISTINCT FROM v_ledger.supplier_id) THEN
    UPDATE public.ledger_entries SET status='REVERSED',outstanding_amount=0 WHERE id=v_ledger.id;
    v_ledger.id:=NULL;
  END IF;
  IF p_supplier_id IS NOT NULL AND v_total>0 THEN
    IF v_ledger.id IS NULL THEN
      INSERT INTO public.ledger_entries(company_id,branch_id,party_type,supplier_id,entry_date,due_date,entry_type,debit_amount,credit_amount,outstanding_amount,source_document_id,status,created_by)
      VALUES(v_doc.company_id,v_doc.branch_id,'SUPPLIER',p_supplier_id,p_document_date,p_document_date,'STOCK_ENTRY_GUIDE',0,v_total,v_total-v_doc.amount_paid,p_document_id,'CONFIRMED',auth.uid());
    ELSE
      UPDATE public.ledger_entries SET supplier_id=p_supplier_id,entry_date=p_document_date,due_date=p_document_date,
        debit_amount=0,credit_amount=v_total,outstanding_amount=v_total-v_doc.amount_paid WHERE id=v_ledger.id;
    END IF;
  END IF;
  UPDATE public.documents SET subtotal=v_total,net_total=v_total,tax_total=0,grand_total=v_total,
    outstanding_amount=CASE WHEN p_supplier_id IS NOT NULL THEN v_total-amount_paid ELSE 0 END,
    stock_posted=true,financial_posted=(p_supplier_id IS NOT NULL AND v_total>0),
    status=CASE WHEN amount_paid>0 AND amount_paid>=v_total THEN 'PAID' WHEN amount_paid>0 THEN 'PARTIALLY_PAID' ELSE 'CONFIRMED' END,
    updated_at=now() WHERE id=p_document_id;
  IF v_old_supplier IS NOT NULL THEN PERFORM private.refresh_supplier_balance(v_old_supplier); END IF;
  IF p_supplier_id IS NOT NULL THEN PERFORM private.refresh_supplier_balance(p_supplier_id); END IF;
  INSERT INTO audit.operational_events(company_id,user_id,branch_id,warehouse_id,event_type,resource_type,resource_id,reason,metadata)
  VALUES(v_doc.company_id,auth.uid(),v_doc.branch_id,p_warehouse_id,'stock_guide.edited','document',p_document_id,NULLIF(TRIM(p_notes),''),
    jsonb_build_object('before',v_before,'after',public.get_stock_guide_v2(p_document_id)));
  RETURN p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_stock_guide_v2(p_document_id UUID,p_reason TEXT,p_idempotency_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,audit,pg_temp AS $$
DECLARE v_doc public.documents; v_type TEXT; v_move RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('settings.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED: settings.manage'; END IF;
  IF NULLIF(TRIM(p_reason),'') IS NULL THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED'; END IF;
  SELECT d.* INTO v_doc FROM public.documents d WHERE d.id=p_document_id AND d.company_id=public.get_user_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_GUIDE_NOT_FOUND'; END IF;
  SELECT code INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  IF v_type NOT IN('STOCK_ENTRY_GUIDE','STOCK_EXIT_GUIDE') THEN RAISE EXCEPTION 'INVALID_STOCK_GUIDE'; END IF;
  IF v_doc.status='CANCELLED' THEN RETURN false; END IF;
  IF v_doc.status='REVERSED' THEN RAISE EXCEPTION 'STOCK_GUIDE_ALREADY_REVERSED'; END IF;
  IF v_doc.amount_paid>0 THEN RAISE EXCEPTION 'REVERSE_SUPPLIER_PAYMENT_BEFORE_CANCELLING_GUIDE'; END IF;
  FOR v_move IN SELECT sm.product_id,sm.warehouse_id,SUM(sm.quantity_in-sm.quantity_out) net_effect,COALESCE(MAX(sm.unit_cost),0) unit_cost
    FROM public.stock_movements sm WHERE sm.source_document_id=p_document_id GROUP BY sm.product_id,sm.warehouse_id HAVING SUM(sm.quantity_in-sm.quantity_out)<>0
  LOOP
    PERFORM public.post_stock_movement(v_doc.company_id,v_move.product_id,v_move.warehouse_id,'reversal',
      GREATEST(-v_move.net_effect,0),GREATEST(v_move.net_effect,0),v_move.unit_cost,p_document_id,NULL,NULL,NULL,v_doc.supplier_id,
      'Anulação de '||v_doc.display_number,NULL);
  END LOOP;
  UPDATE public.ledger_entries SET status='REVERSED',outstanding_amount=0 WHERE source_document_id=p_document_id AND status='CONFIRMED';
  UPDATE public.documents SET status='CANCELLED',outstanding_amount=0,stock_posted=false,financial_posted=false,
    cancelled_by=auth.uid(),cancelled_at=now(),cancellation_reason=TRIM(p_reason),updated_by=auth.uid(),updated_at=now() WHERE id=p_document_id;
  IF v_doc.supplier_id IS NOT NULL THEN PERFORM private.refresh_supplier_balance(v_doc.supplier_id); END IF;
  INSERT INTO public.document_status_history(company_id,document_id,previous_status,new_status,reason,changed_by)
  VALUES(v_doc.company_id,p_document_id,v_doc.status,'CANCELLED',TRIM(p_reason),auth.uid());
  INSERT INTO audit.operational_events(company_id,user_id,branch_id,warehouse_id,event_type,resource_type,resource_id,reason,idempotency_key,metadata)
  VALUES(v_doc.company_id,auth.uid(),v_doc.branch_id,v_doc.warehouse_id,'stock_guide.cancelled','document',p_document_id,TRIM(p_reason),p_idempotency_key,
    jsonb_build_object('guide_number',v_doc.display_number,'supplier_id',v_doc.supplier_id,'total',v_doc.grand_total));
  RETURN true;
END;
$$;

-- Include the guide-specific fields in the shared document loader.
CREATE OR REPLACE FUNCTION public.get_operational_documents_page_v2(p_limit INT DEFAULT 1000,p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH selected AS(
    SELECT d.* FROM public.documents d WHERE d.company_id=public.get_user_company_id() AND public.has_permission('documents.view')
    ORDER BY d.created_at DESC,d.id DESC LIMIT LEAST(GREATEST(COALESCE(p_limit,1000),1),2000) OFFSET GREATEST(COALESCE(p_offset,0),0)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',d.id,'display_number',d.display_number,'external_reference',d.external_reference,'warehouse_id',d.warehouse_id,
    'document_date',d.document_date,'due_date',d.due_date,'created_at',d.created_at,'source_document_id',d.source_document_id,
    'status',d.status,'notes',d.notes,'subtotal',d.subtotal,'discount_total',d.discount_total,'general_discount_amount',d.general_discount_amount,
    'net_total',d.net_total,'tax_total',d.tax_total,'grand_total',d.grand_total,'amount_paid',d.amount_paid,
    'outstanding_amount',d.outstanding_amount,'salesperson_name',d.salesperson_name,'customer_id',d.customer_id,'supplier_id',d.supplier_id,
    'customers',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('customer_number',c.customer_number,'name',c.name,'tax_number',c.tax_number) END,
    'suppliers',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('supplier_number',s.supplier_number,'name',s.name,'tax_number',s.tax_number) END,
    'payment_terms',CASE WHEN pt.id IS NULL THEN NULL ELSE jsonb_build_object('code',pt.code,'name',pt.name) END,
    'document_types',jsonb_build_object('code',dt.code,'name',dt.name,'party_type',dt.party_type),
    'document_lines',COALESCE(lines.items,'[]'::jsonb)
  ) ORDER BY d.created_at DESC,d.id DESC),'[]'::jsonb)
  FROM selected d JOIN public.document_types dt ON dt.id=d.document_type_id
  LEFT JOIN public.customers c ON c.id=d.customer_id LEFT JOIN public.suppliers s ON s.id=d.supplier_id
  LEFT JOIN public.payment_terms pt ON pt.id=d.payment_term_id
  LEFT JOIN LATERAL(SELECT jsonb_agg(jsonb_build_object(
    'id',dl.id,'product_id',dl.product_id,'product_code_snapshot',dl.product_code_snapshot,'description_snapshot',dl.description_snapshot,
    'quantity',dl.quantity,'unit_price',dl.unit_price,'unit_cost_snapshot',dl.unit_cost_snapshot,'discount_percentage',dl.discount_percentage,
    'discount_amount',dl.discount_amount,'tax_rate_snapshot',dl.tax_rate_snapshot,'total_amount',dl.total_amount,
    'stock_effect_enabled',dl.stock_effect_enabled,'cost_was_provided',gd.cost_was_provided,'sale_price_incl',gd.sale_price_incl
  ) ORDER BY dl.line_number) items FROM public.document_lines dl
  LEFT JOIN public.stock_guide_line_details gd ON gd.document_line_id=dl.id WHERE dl.document_id=d.id)lines ON true;
$$;

REVOKE ALL ON FUNCTION private.apply_stock_guide_lines_v2(UUID,UUID,UUID,TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_stock_guide_v2(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_stock_guide_v2(TEXT,TEXT,DATE,UUID,UUID,TEXT,JSONB,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_stock_guide_v2(UUID,TEXT,DATE,UUID,UUID,TEXT,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancel_stock_guide_v2(UUID,TEXT,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_operational_documents_page_v2(INT,INT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_stock_guide_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_stock_guide_v2(TEXT,TEXT,DATE,UUID,UUID,TEXT,JSONB,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stock_guide_v2(UUID,TEXT,DATE,UUID,UUID,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_guide_v2(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_documents_page_v2(INT,INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_supplier_total_purchases_summary()
RETURNS TABLE(supplier_id UUID,total_purchases NUMERIC(15,2))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT d.supplier_id,COALESCE(SUM(d.grand_total),0)::NUMERIC(15,2)
  FROM public.documents d JOIN public.document_types dt ON dt.id=d.document_type_id
  WHERE d.company_id=public.get_user_company_id() AND d.supplier_id IS NOT NULL
    AND dt.code IN('SUPPLIER_INVOICE','STOCK_ENTRY_GUIDE')
    AND d.status IN('CONFIRMED','PARTIALLY_PAID','PAID')
  GROUP BY d.supplier_id;
$$;
REVOKE ALL ON FUNCTION public.get_supplier_total_purchases_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_supplier_total_purchases_summary() TO authenticated;

COMMIT;
