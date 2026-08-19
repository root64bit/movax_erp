-- MOVAX ERP / POS
-- Cash sales and immediate-payment invoices must be financially settled in the
-- same database transaction that confirms the commercial document.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_and_confirm_customer_sale_v3(
  p_customer_id UUID,
  p_document_date DATE,
  p_payment_term_code TEXT,
  p_items JSONB,
  p_idempotency_key TEXT,
  p_document_type_code TEXT DEFAULT 'CUSTOMER_INVOICE',
  p_notes TEXT DEFAULT NULL,
  p_general_discount NUMERIC DEFAULT 0,
  p_payment_method_code TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_doc public.documents;
  v_method public.payment_methods;
  v_payment public.payments;
  v_payment_id UUID;
  v_payment_key TEXT;
  v_should_settle BOOLEAN := false;
  v_company_id UUID;
  v_amount NUMERIC(18,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NULLIF(TRIM(COALESCE(p_idempotency_key,'')), '') IS NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED'; END IF;

  v_company_id := public.get_user_company_id();

  v_doc := public.create_and_confirm_customer_sale_v2(
    p_customer_id,
    p_document_date,
    p_payment_term_code,
    p_items,
    p_idempotency_key,
    p_document_type_code,
    p_notes,
    p_general_discount
  );

  v_should_settle := p_document_type_code = 'CASH_SALE';
  IF NOT v_should_settle AND p_document_type_code = 'CUSTOMER_INVOICE' THEN
    SELECT COALESCE(pt.requires_immediate_payment,false)
    INTO v_should_settle
    FROM public.payment_terms pt
    WHERE pt.company_id=v_company_id
      AND pt.code=COALESCE(NULLIF(TRIM(p_payment_term_code),''),'DINHEIRO')
      AND pt.active
    LIMIT 1;
  END IF;

  IF NOT v_should_settle OR COALESCE(v_doc.outstanding_amount,0) <= 0 THEN
    RETURN v_doc;
  END IF;

  SELECT * INTO v_method
  FROM public.payment_methods pm
  WHERE (pm.company_id=v_company_id OR pm.company_id IS NULL)
    AND pm.code=COALESCE(NULLIF(TRIM(p_payment_method_code),''),'CASH')
    AND pm.active
    AND pm.allows_customer_receipt
  ORDER BY pm.company_id NULLS LAST
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_METHOD_NOT_FOUND'; END IF;
  IF v_method.requires_reference AND NULLIF(TRIM(COALESCE(p_payment_reference,'')), '') IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED';
  END IF;

  v_payment_key := p_idempotency_key || ':AUTO_PAYMENT';
  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.company_id=v_company_id AND p.idempotency_key=v_payment_key;
  IF FOUND THEN
    SELECT * INTO v_doc FROM public.documents WHERE id=v_doc.id;
    RETURN v_doc;
  END IF;

  v_amount := v_doc.outstanding_amount;

  INSERT INTO public.payments (
    company_id,branch_id,fiscal_period_id,payment_date,direction,
    customer_id,total_amount,status,external_reference,description,
    idempotency_key,created_by,updated_by
  ) VALUES (
    v_doc.company_id,v_doc.branch_id,v_doc.fiscal_period_id,p_document_date,'CUSTOMER_RECEIPT',
    v_doc.customer_id,v_amount,'DRAFT',NULLIF(TRIM(p_payment_reference),''),
    'Liquidação automática de ' || v_doc.display_number,
    v_payment_key,auth.uid(),auth.uid()
  ) RETURNING id INTO v_payment_id;

  INSERT INTO public.payment_method_entries (
    company_id,payment_id,line_number,payment_method_id,amount,reference
  ) VALUES (
    v_doc.company_id,v_payment_id,1,v_method.id,v_amount,NULLIF(TRIM(p_payment_reference),'')
  );

  PERFORM private.confirm_customer_payment(v_payment_id,v_payment_key,'NONE');
  PERFORM private.allocate_payment(v_payment_id,v_doc.id,v_amount);

  SELECT * INTO v_doc FROM public.documents WHERE id=v_doc.id;
  RETURN v_doc;
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_confirm_customer_sale_v3(UUID,DATE,TEXT,JSONB,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_customer_sale_v3(UUID,DATE,TEXT,JSONB,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;

COMMIT;
