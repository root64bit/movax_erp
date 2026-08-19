BEGIN;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS general_discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0
  CHECK (general_discount_amount >= 0);

CREATE OR REPLACE FUNCTION public.resolve_or_create_operational_customer_v2(
  p_customer_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_nuit TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL,
  p_keep_as_walk_in BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_walk_in_id UUID;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (public.has_permission('sales.create') OR public.has_permission('customers.create')) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: sales.create or customers.create required';
  END IF;

  v_company_id := public.get_user_company_id();
  IF p_keep_as_walk_in THEN
    SELECT c.id INTO v_walk_in_id
    FROM public.customers c
    WHERE c.company_id = v_company_id
      AND c.active
      AND (
        c.customer_number IN ('1', '01', 'CL-001')
        OR LOWER(TRIM(c.name)) IN ('cliente pontual', 'cliente final', 'pontual', 'ibz')
      )
    ORDER BY CASE c.customer_number WHEN '1' THEN 0 WHEN '01' THEN 1 ELSE 2 END, c.created_at
    LIMIT 1;
    IF v_walk_in_id IS NULL THEN RAISE EXCEPTION 'WALK_IN_CUSTOMER_NOT_FOUND'; END IF;
    RETURN v_walk_in_id;
  END IF;

  RETURN public.resolve_or_create_operational_customer(
    p_customer_id, p_client_name, p_client_nuit, p_client_address
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_or_create_operational_customer_v2(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_or_create_operational_customer_v2(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- One totals function is used by creation and editing. User-facing discounts are
-- inclusive monetary values; general discount is allocated proportionally for tax.
CREATE OR REPLACE FUNCTION public.recalculate_document(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gross_incl NUMERIC(18,2) := 0;
  v_line_discount NUMERIC(18,2) := 0;
  v_net_before NUMERIC(18,2) := 0;
  v_tax_before NUMERIC(18,2) := 0;
  v_before_general NUMERIC(18,2) := 0;
  v_general NUMERIC(18,2) := 0;
  v_factor NUMERIC := 0;
  v_net NUMERIC(18,2) := 0;
  v_tax NUMERIC(18,2) := 0;
  v_grand NUMERIC(18,2) := 0;
BEGIN
  SELECT
    COALESCE(SUM(total_amount + discount_amount), 0),
    COALESCE(SUM(discount_amount), 0),
    COALESCE(SUM(net_amount), 0),
    COALESCE(SUM(tax_amount), 0),
    COALESCE(SUM(total_amount), 0)
  INTO v_gross_incl, v_line_discount, v_net_before, v_tax_before, v_before_general
  FROM public.document_lines
  WHERE document_id = p_document_id;

  SELECT LEAST(COALESCE(general_discount_amount, 0), v_before_general)
  INTO v_general
  FROM public.documents
  WHERE id = p_document_id;

  v_factor := CASE WHEN v_before_general > 0
    THEN (v_before_general - v_general) / v_before_general ELSE 0 END;
  v_grand := ROUND(v_before_general - v_general, 2);
  v_net := ROUND(v_net_before * v_factor, 2);
  v_tax := ROUND(v_grand - v_net, 2);

  UPDATE public.documents
  SET subtotal = ROUND(v_gross_incl, 2),
      discount_total = ROUND(v_line_discount + v_general, 2),
      net_total = v_net,
      tax_total = v_tax,
      grand_total = v_grand,
      outstanding_amount = GREATEST(v_grand - amount_paid, 0),
      updated_at = now()
  WHERE id = p_document_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.replace_document_lines_v2(
  p_document_id UUID,
  p_company_id UUID,
  p_items JSONB,
  p_general_discount NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_line_no INTEGER := 0;
  v_product public.products;
  v_product_id UUID;
  v_qty NUMERIC(18,3);
  v_price_incl NUMERIC(18,4);
  v_price_excl NUMERIC(18,4);
  v_discount NUMERIC(18,2);
  v_discount_pct NUMERIC(9,4);
  v_tax_rate NUMERIC(9,4);
  v_gross_incl NUMERIC(18,2);
  v_total NUMERIC(18,2);
  v_net NUMERIC(18,2);
  v_tax NUMERIC(18,2);
  v_stock_effect BOOLEAN;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'DOCUMENT_LINES_REQUIRED';
  END IF;

  DELETE FROM public.document_lines WHERE document_id = p_document_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_line_no := v_line_no + 1;
    v_qty := COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 0);
    v_price_incl := COALESCE(NULLIF(v_item->>'unitPrice', '')::NUMERIC,
                             NULLIF(v_item->>'unit_price_incl', '')::NUMERIC, 0);
    v_discount := COALESCE(NULLIF(v_item->>'discountAmount', '')::NUMERIC,
                           NULLIF(v_item->>'discount_amount', '')::NUMERIC, 0);
    v_tax_rate := COALESCE(NULLIF(v_item->>'ivaPercent', '')::NUMERIC,
                           NULLIF(v_item->>'tax_rate', '')::NUMERIC, 16);

    IF v_qty <= 0 THEN RAISE EXCEPTION 'INVALID_LINE_QUANTITY: line %', v_line_no; END IF;
    IF v_price_incl < 0 THEN RAISE EXCEPTION 'INVALID_LINE_PRICE: line %', v_line_no; END IF;
    v_gross_incl := ROUND(v_qty * v_price_incl, 2);
    IF v_discount < 0 OR v_discount > v_gross_incl THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT_AMOUNT: line %, maximum %', v_line_no, v_gross_incl;
    END IF;

    v_product_id := NULL;
    v_product := NULL;
    IF COALESCE(v_item->>'articleId', v_item->>'article_id', '')
       ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT * INTO v_product
      FROM public.products
      WHERE id = COALESCE(v_item->>'articleId', v_item->>'article_id')::UUID
        AND company_id = p_company_id
        AND is_active;
      IF FOUND THEN v_product_id := v_product.id; END IF;
    END IF;

    v_stock_effect := v_product_id IS NOT NULL
      AND COALESCE((v_item->>'stockEffectEnabled')::BOOLEAN,
                   (v_item->>'stock_effect_enabled')::BOOLEAN, true)
      AND UPPER(COALESCE(v_item->>'lineType', v_item->>'line_type', 'STOCK')) = 'STOCK';
    v_price_excl := ROUND(v_price_incl / (1 + v_tax_rate / 100), 4);
    v_total := ROUND(v_gross_incl - v_discount, 2);
    v_net := ROUND(v_total / (1 + v_tax_rate / 100), 2);
    v_tax := ROUND(v_total - v_net, 2);
    v_discount_pct := CASE WHEN v_gross_incl > 0
      THEN ROUND(v_discount / v_gross_incl * 100, 4) ELSE 0 END;

    INSERT INTO public.document_lines (
      company_id, document_id, line_number, product_id,
      product_code_snapshot, description_snapshot, unit_code_snapshot,
      quantity, unit_price, discount_percentage, discount_amount,
      tax_code_id, tax_code_snapshot, tax_rate_snapshot,
      net_amount, tax_amount, total_amount, unit_cost_snapshot, stock_effect_enabled
    ) VALUES (
      p_company_id, p_document_id, v_line_no, v_product_id,
      COALESCE(NULLIF(TRIM(COALESCE(v_item->>'code', '')), ''), CASE WHEN v_stock_effect THEN v_product.code ELSE 'DIV' END),
      COALESCE(NULLIF(TRIM(COALESCE(v_item->>'description', '')), ''), v_product.description, 'Artigo / Serviço'),
      'UN',
      v_qty, v_price_excl, v_discount_pct, ROUND(v_discount, 2),
      v_product.tax_code_id, CASE WHEN v_tax_rate = 0 THEN 'ISENTO' ELSE 'IVA' || v_tax_rate::TEXT END,
      v_tax_rate, v_net, v_tax, v_total, COALESCE(v_product.avg_cost, 0), v_stock_effect
    );
  END LOOP;

  UPDATE public.documents
  SET general_discount_amount = LEAST(GREATEST(COALESCE(p_general_discount, 0), 0),
                                      (SELECT COALESCE(SUM(total_amount), 0) FROM public.document_lines WHERE document_id = p_document_id))
  WHERE id = p_document_id;
  PERFORM public.recalculate_document(p_document_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_and_confirm_customer_sale_v2(
  p_customer_id UUID,
  p_document_date DATE,
  p_payment_term_code TEXT,
  p_items JSONB,
  p_idempotency_key TEXT,
  p_document_type_code TEXT DEFAULT 'CUSTOMER_INVOICE',
  p_notes TEXT DEFAULT NULL,
  p_general_discount NUMERIC DEFAULT 0
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_branch_id UUID;
  v_warehouse_id UUID;
  v_period_id UUID;
  v_document_type_id UUID;
  v_payment_term_id UUID;
  v_document_id UUID;
  v_result public.documents;
  v_salesperson TEXT;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT public.has_permission('sales.create') OR NOT public.has_permission('sales.confirm') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: sales.create and sales.confirm required';
  END IF;
  IF p_document_type_code NOT IN ('CUSTOMER_INVOICE','CASH_SALE','CUSTOMER_DELIVERY_NOTE') THEN
    RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE';
  END IF;
  SELECT * INTO v_result FROM public.documents
  WHERE idempotency_key = p_idempotency_key AND company_id = public.get_user_company_id();
  IF FOUND THEN RETURN v_result; END IF;

  v_company_id := public.get_user_company_id();
  SELECT id INTO v_branch_id FROM public.branches WHERE company_id=v_company_id AND is_active ORDER BY code LIMIT 1;
  SELECT id INTO v_warehouse_id FROM public.warehouses WHERE company_id=v_company_id AND is_active ORDER BY is_default DESC, code LIMIT 1;
  SELECT id INTO v_period_id FROM public.fiscal_periods WHERE company_id=v_company_id AND p_document_date BETWEEN start_date AND end_date AND status='open' ORDER BY start_date DESC LIMIT 1;
  SELECT id INTO v_document_type_id FROM public.document_types WHERE company_id=v_company_id AND code=p_document_type_code AND active;
  SELECT id INTO v_payment_term_id FROM public.payment_terms WHERE company_id=v_company_id AND code=COALESCE(NULLIF(TRIM(p_payment_term_code),''),'DINHEIRO') AND active;
  SELECT full_name INTO v_salesperson FROM public.user_profiles WHERE id=auth.uid();
  IF v_branch_id IS NULL OR v_warehouse_id IS NULL OR v_period_id IS NULL OR v_document_type_id IS NULL OR v_payment_term_id IS NULL THEN
    RAISE EXCEPTION 'OPERATIONAL_REFERENCE_DATA_INCOMPLETE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id=p_customer_id AND company_id=v_company_id AND active
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND_OR_INACTIVE';
  END IF;

  INSERT INTO public.documents (
    company_id,branch_id,warehouse_id,document_type_id,fiscal_period_id,
    document_date,due_date,customer_id,payment_term_id,status,salesperson_name,
    notes,idempotency_key,created_by,updated_by,general_discount_amount
  ) VALUES (
    v_company_id,v_branch_id,v_warehouse_id,v_document_type_id,v_period_id,
    p_document_date,p_document_date+(SELECT payment_days FROM public.payment_terms WHERE id=v_payment_term_id),
    p_customer_id,v_payment_term_id,'DRAFT',COALESCE(v_salesperson,'Operador Casa de Pneus'),
    p_notes,p_idempotency_key,auth.uid(),auth.uid(),GREATEST(COALESCE(p_general_discount,0),0)
  ) RETURNING id INTO v_document_id;

  PERFORM private.replace_document_lines_v2(v_document_id,v_company_id,p_items,p_general_discount);
  SELECT * INTO v_result FROM private.confirm_customer_document(v_document_id,p_idempotency_key);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_confirm_customer_sale_v2(UUID,DATE,TEXT,JSONB,TEXT,TEXT,TEXT,NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_customer_sale_v2(UUID,DATE,TEXT,JSONB,TEXT,TEXT,TEXT,NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_and_confirm_customer_quotation_v2(
  p_customer_id UUID,
  p_document_date DATE,
  p_items JSONB,
  p_notes TEXT,
  p_idempotency_key TEXT,
  p_general_discount NUMERIC DEFAULT 0
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_branch_id UUID;
  v_warehouse_id UUID;
  v_period_id UUID;
  v_type_id UUID;
  v_term_id UUID;
  v_document_id UUID;
  v_result public.documents;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('sales.create') THEN RAISE EXCEPTION 'PERMISSION_DENIED: sales.create'; END IF;
  v_company_id := public.get_user_company_id();
  SELECT * INTO v_result FROM public.documents
  WHERE idempotency_key=p_idempotency_key AND company_id=v_company_id;
  IF FOUND THEN RETURN v_result; END IF;
  SELECT id INTO v_branch_id FROM public.branches WHERE company_id=v_company_id AND is_active ORDER BY code LIMIT 1;
  SELECT id INTO v_warehouse_id FROM public.warehouses WHERE company_id=v_company_id AND is_active ORDER BY is_default DESC,code LIMIT 1;
  SELECT id INTO v_period_id FROM public.fiscal_periods WHERE company_id=v_company_id AND p_document_date BETWEEN start_date AND end_date AND status='open' ORDER BY start_date DESC LIMIT 1;
  SELECT id INTO v_type_id FROM public.document_types WHERE company_id=v_company_id AND code='CUSTOMER_QUOTATION' AND active;
  SELECT id INTO v_term_id FROM public.payment_terms WHERE company_id=v_company_id AND active ORDER BY payment_days LIMIT 1;
  IF v_branch_id IS NULL OR v_warehouse_id IS NULL OR v_period_id IS NULL OR v_type_id IS NULL OR v_term_id IS NULL THEN
    RAISE EXCEPTION 'OPERATIONAL_REFERENCE_DATA_INCOMPLETE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id=p_customer_id AND company_id=v_company_id AND active
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND_OR_INACTIVE';
  END IF;

  INSERT INTO public.documents (
    company_id,branch_id,warehouse_id,document_type_id,fiscal_period_id,document_date,due_date,
    customer_id,payment_term_id,status,notes,idempotency_key,created_by,updated_by,general_discount_amount
  ) VALUES (
    v_company_id,v_branch_id,v_warehouse_id,v_type_id,v_period_id,p_document_date,p_document_date+15,
    p_customer_id,v_term_id,'DRAFT',p_notes,p_idempotency_key,auth.uid(),auth.uid(),GREATEST(COALESCE(p_general_discount,0),0)
  ) RETURNING id INTO v_document_id;
  PERFORM private.replace_document_lines_v2(v_document_id,v_company_id,p_items,p_general_discount);
  SELECT * INTO v_result FROM private.confirm_customer_document(v_document_id,p_idempotency_key);
  UPDATE public.documents
  SET display_number='COT-'||TO_CHAR(document_date,'YYYY')||'/'||LPAD(document_number::TEXT,3,'0')
  WHERE id=v_document_id RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_confirm_customer_quotation_v2(UUID,DATE,JSONB,TEXT,TEXT,NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_customer_quotation_v2(UUID,DATE,JSONB,TEXT,TEXT,NUMERIC) TO authenticated;

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
  v_manage_stock BOOLEAN := false;
BEGIN
  SELECT * INTO v_doc FROM public.documents
  WHERE id=p_document_id AND company_id=public.get_user_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  IF auth.uid() IS NULL OR NOT public.has_permission('sales.create') THEN RAISE EXCEPTION 'PERMISSION_DENIED: sales.create'; END IF;
  SELECT * INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  IF v_doc.status IN ('CANCELLED','REVERSED') THEN
    RAISE EXCEPTION 'DOCUMENT_CANNOT_BE_EDITED_IN_STATUS_%', v_doc.status;
  END IF;
  v_manage_stock := v_type.affects_stock
    AND (v_doc.stock_posted OR v_doc.migration_batch_id IS NULL);
  v_old_customer := v_doc.customer_id;
  v_name := COALESCE(NULLIF(TRIM(p_client_name),''),'Cliente Pontual');
  v_nuit := COALESCE(NULLIF(TRIM(p_client_nuit),''),'N/A');
  v_address := COALESCE(NULLIF(TRIM(p_client_address),''),'N/A');
  v_new_customer := public.resolve_or_create_operational_customer_v2(v_doc.customer_id,v_name,v_nuit,v_address,p_keep_as_walk_in);

  SELECT jsonb_build_object('document',to_jsonb(d),'lines',COALESCE(jsonb_agg(to_jsonb(dl) ORDER BY dl.line_number) FILTER (WHERE dl.id IS NOT NULL),'[]'::jsonb))
  INTO v_old_snapshot FROM public.documents d LEFT JOIN public.document_lines dl ON dl.document_id=d.id WHERE d.id=p_document_id GROUP BY d.id;

  IF p_lines IS NOT NULL THEN
    IF v_manage_stock THEN
      FOR v_line IN SELECT * FROM public.document_lines
        WHERE document_id=p_document_id AND stock_effect_enabled AND product_id IS NOT NULL
        ORDER BY line_number
      LOOP
        PERFORM public.post_stock_movement(
          v_doc.company_id,v_line.product_id,v_doc.warehouse_id,'reversal',
          v_line.quantity,0,COALESCE(v_line.unit_cost_snapshot,0),p_document_id,v_line.id,
          NULL,v_new_customer,NULL,'Reversão por edição de '||v_doc.display_number,NULL
        );
      END LOOP;
    END IF;

    PERFORM private.replace_document_lines_v2(p_document_id,v_doc.company_id,p_lines,p_general_discount);

    IF v_manage_stock THEN
      FOR v_line IN SELECT * FROM public.document_lines WHERE document_id=p_document_id AND stock_effect_enabled AND product_id IS NOT NULL
      LOOP
        PERFORM public.post_stock_movement(
          v_doc.company_id,v_line.product_id,v_doc.warehouse_id,'sales_exit',0,v_line.quantity,
          COALESCE(v_line.unit_cost_snapshot,0),p_document_id,v_line.id,NULL,v_new_customer,NULL,
          'Reposição após edição de '||v_doc.display_number,NULL
        );
      END LOOP;
    END IF;
  END IF;

  IF (SELECT grand_total FROM public.documents WHERE id=p_document_id) < v_doc.amount_paid THEN
    RAISE EXCEPTION 'DOCUMENT_TOTAL_BELOW_AMOUNT_ALREADY_PAID: %', v_doc.amount_paid;
  END IF;

  UPDATE public.documents
  SET customer_id=v_new_customer,
      notes=TRIM(CONCAT('[CLIENTE: ',v_name,' | NUIT: ',v_nuit,' | MORADA: ',v_address,'] ',COALESCE(TRIM(p_notes),''))),
      outstanding_amount=GREATEST(grand_total-amount_paid,0),
      stock_posted=CASE WHEN v_manage_stock THEN EXISTS (
        SELECT 1 FROM public.document_lines dl
        WHERE dl.document_id=p_document_id AND dl.stock_effect_enabled AND dl.product_id IS NOT NULL
      ) ELSE stock_posted END,
      updated_by=auth.uid(),updated_at=now()
  WHERE id=p_document_id;

  IF v_type.affects_customer_account AND v_doc.financial_posted THEN
    UPDATE public.ledger_entries
    SET customer_id=v_new_customer,debit_amount=(SELECT grand_total FROM public.documents WHERE id=p_document_id),
        outstanding_amount=(SELECT outstanding_amount FROM public.documents WHERE id=p_document_id)
    WHERE source_document_id=p_document_id AND status <> 'REVERSED';
    IF v_old_customer IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_old_customer); END IF;
    IF v_new_customer IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_new_customer); END IF;
  END IF;

  SELECT jsonb_build_object('document',to_jsonb(d),'lines',COALESCE(jsonb_agg(to_jsonb(dl) ORDER BY dl.line_number) FILTER (WHERE dl.id IS NOT NULL),'[]'::jsonb))
  INTO v_new_snapshot FROM public.documents d LEFT JOIN public.document_lines dl ON dl.document_id=d.id WHERE d.id=p_document_id GROUP BY d.id;
  INSERT INTO audit.operational_events(company_id,user_id,branch_id,warehouse_id,event_type,resource_type,resource_id,reason,metadata)
  VALUES(v_doc.company_id,auth.uid(),v_doc.branch_id,v_doc.warehouse_id,'document.edited','document',p_document_id,
         NULLIF(TRIM(p_notes),''),jsonb_build_object('before',v_old_snapshot,'after',v_new_snapshot));
END;
$$;

REVOKE ALL ON FUNCTION public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operational_document_v2(UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,JSONB,NUMERIC,BOOLEAN) TO authenticated;

-- Administrator-only master-data maintenance. Deactivation preserves all history.
CREATE OR REPLACE FUNCTION public.admin_update_operational_party(
  p_party_type TEXT,
  p_party_id UUID,
  p_data JSONB,
  p_active BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, audit, pg_temp
AS $$
DECLARE
  v_company UUID := public.get_user_company_id();
  v_number TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('settings.manage') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: administrator required';
  END IF;
  IF UPPER(p_party_type)='CUSTOMER' THEN
    SELECT customer_number INTO v_number FROM public.customers WHERE id=p_party_id AND company_id=v_company FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;
    IF v_number IN ('1','01','CL-001') AND NOT p_active THEN RAISE EXCEPTION 'WALK_IN_CUSTOMER_CANNOT_BE_DEACTIVATED'; END IF;
    UPDATE public.customers SET
      customer_number=CASE WHEN v_number IN ('1','01','CL-001') THEN v_number ELSE COALESCE(NULLIF(TRIM(p_data->>'number'),''),customer_number) END,
      name=COALESCE(NULLIF(TRIM(p_data->>'name'),''),name),tax_number=NULLIF(TRIM(p_data->>'tax_number'),''),
      telephone=NULLIF(TRIM(p_data->>'telephone'),''),email=NULLIF(LOWER(TRIM(p_data->>'email')),''),
      credit_limit=COALESCE(NULLIF(p_data->>'credit_limit','')::NUMERIC,credit_limit),active=p_active,updated_by=auth.uid(),updated_at=now()
    WHERE id=p_party_id AND company_id=v_company;
    IF NULLIF(TRIM(p_data->>'address'),'') IS NOT NULL THEN
      UPDATE public.customer_addresses SET address_line_1=TRIM(p_data->>'address'),city=NULLIF(TRIM(p_data->>'city'),''),updated_at=now()
      WHERE customer_id=p_party_id AND is_primary;
      IF NOT FOUND THEN INSERT INTO public.customer_addresses(company_id,customer_id,address_type,address_line_1,city,is_primary)
        VALUES(v_company,p_party_id,'GENERAL',TRIM(p_data->>'address'),NULLIF(TRIM(p_data->>'city'),''),true); END IF;
    END IF;
  ELSIF UPPER(p_party_type)='SUPPLIER' THEN
    SELECT supplier_number INTO v_number FROM public.suppliers WHERE id=p_party_id AND company_id=v_company FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'SUPPLIER_NOT_FOUND'; END IF;
    UPDATE public.suppliers SET
      supplier_number=COALESCE(NULLIF(TRIM(p_data->>'number'),''),supplier_number),name=COALESCE(NULLIF(TRIM(p_data->>'name'),''),name),
      tax_number=NULLIF(TRIM(p_data->>'tax_number'),''),telephone=NULLIF(TRIM(p_data->>'telephone'),''),
      email=NULLIF(LOWER(TRIM(p_data->>'email')),''),contact_person=NULLIF(TRIM(p_data->>'contact_person'),''),
      credit_limit=COALESCE(NULLIF(p_data->>'credit_limit','')::NUMERIC,credit_limit),active=p_active,updated_by=auth.uid(),updated_at=now()
    WHERE id=p_party_id AND company_id=v_company;
    IF NULLIF(TRIM(p_data->>'address'),'') IS NOT NULL THEN
      UPDATE public.supplier_addresses SET address_line_1=TRIM(p_data->>'address'),city=NULLIF(TRIM(p_data->>'city'),''),updated_at=now()
      WHERE supplier_id=p_party_id AND is_primary;
      IF NOT FOUND THEN INSERT INTO public.supplier_addresses(company_id,supplier_id,address_type,address_line_1,city,is_primary)
        VALUES(v_company,p_party_id,'GENERAL',TRIM(p_data->>'address'),NULLIF(TRIM(p_data->>'city'),''),true); END IF;
    END IF;
  ELSE RAISE EXCEPTION 'INVALID_PARTY_TYPE'; END IF;
  INSERT INTO audit.operational_events(company_id,user_id,event_type,resource_type,resource_id,metadata)
  VALUES(v_company,auth.uid(),'party.updated',LOWER(p_party_type),p_party_id,jsonb_build_object('active',p_active,'data',p_data));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_operational_party(TEXT,UUID,JSONB,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_operational_party(TEXT,UUID,JSONB,BOOLEAN) TO authenticated;

-- Seed quotation sequence from existing documents without changing FT/VD/GR.
INSERT INTO public.document_sequences(company_id,document_type,series,current_number,fiscal_period_id,prefix)
SELECT fp.company_id,'CUSTOMER_QUOTATION','A',
       COALESCE((SELECT MAX(substring(d.display_number FROM '([0-9]+)$')::INTEGER)
                 FROM public.documents d JOIN public.document_types dt ON dt.id=d.document_type_id
                 WHERE d.company_id=fp.company_id AND dt.code='CUSTOMER_QUOTATION' AND d.display_number ~ '[0-9]+$'),0),
       fp.id,'COT-'
FROM public.fiscal_periods fp
WHERE CURRENT_DATE BETWEEN fp.start_date AND fp.end_date
ON CONFLICT (company_id,document_type,series,fiscal_period_id)
DO UPDATE SET current_number=GREATEST(public.document_sequences.current_number,EXCLUDED.current_number),updated_at=now();

CREATE INDEX IF NOT EXISTS idx_customers_company_normalized_name ON public.customers(company_id,LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS idx_customers_company_tax_number ON public.customers(company_id,tax_number) WHERE tax_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_company_date_type ON public.documents(company_id,document_date DESC,document_type_id);
CREATE INDEX IF NOT EXISTS idx_document_lines_document_line ON public.document_lines(document_id,line_number);

COMMIT;
