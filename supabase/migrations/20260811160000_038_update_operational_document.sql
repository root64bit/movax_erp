BEGIN;

-- Resolve the customer typed on a commercial document in one database transaction.
-- The per-company advisory lock makes the sequential customer number safe when two
-- operators save new customers at the same time.
CREATE OR REPLACE FUNCTION public.resolve_or_create_operational_customer(
  p_customer_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_nuit TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_customer_id UUID;
  v_payment_term_id UUID;
  v_name TEXT;
  v_normalized_name TEXT;
  v_nuit TEXT;
  v_normalized_nuit TEXT;
  v_address TEXT;
  v_max_customer_number BIGINT;
  v_next_customer_number TEXT;
  v_attempt INTEGER := 0;
  v_is_walk_in BOOLEAN;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.has_permission('sales.create')
       OR public.has_permission('customers.create')
     ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: sales.create or customers.create required';
  END IF;

  v_company_id := public.get_user_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'USER_COMPANY_NOT_FOUND';
  END IF;

  v_name := NULLIF(regexp_replace(TRIM(COALESCE(p_client_name, '')), '\s+', ' ', 'g'), '');
  v_normalized_name := LOWER(COALESCE(v_name, ''));
  v_nuit := NULLIF(TRIM(COALESCE(p_client_nuit, '')), '');
  IF UPPER(COALESCE(v_nuit, '')) IN ('N/A', 'NA', 'N.D.', 'ND') THEN
    v_nuit := NULL;
  END IF;
  v_normalized_nuit := NULLIF(UPPER(regexp_replace(COALESCE(v_nuit, ''), '\s+', '', 'g')), '');
  v_address := NULLIF(TRIM(COALESCE(p_client_address, '')), '');

  SELECT c.id
  INTO v_customer_id
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.company_id = v_company_id
    AND c.active;

  v_is_walk_in := v_normalized_name IN (
    '', 'cliente pontual', 'cliente final', 'pontual', 'ibz'
  );

  IF v_is_walk_in THEN
    -- A blank name preserves a valid explicit selection. A walk-in name explicitly
    -- selects the company's walk-in customer instead of retaining the old document link.
    IF v_normalized_name = '' AND v_customer_id IS NOT NULL THEN
      RETURN v_customer_id;
    END IF;

    SELECT c.id
    INTO v_customer_id
    FROM public.customers c
    WHERE c.company_id = v_company_id
      AND c.active
      AND (
        c.customer_number IN ('1', '01', 'CL-001')
        OR LOWER(TRIM(c.name)) IN ('cliente pontual', 'cliente final', 'pontual', 'ibz')
      )
    ORDER BY
      CASE
        WHEN c.customer_number = '1' THEN 0
        WHEN c.customer_number = '01' THEN 1
        WHEN c.customer_number = 'CL-001' THEN 2
        ELSE 3
      END,
      c.created_at
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'WALK_IN_CUSTOMER_NOT_FOUND';
    END IF;
    RETURN v_customer_id;
  END IF;

  -- Serialise lookup + number allocation for this company. This prevents duplicate
  -- customer records and duplicate sequential codes under concurrent saves.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_company_id::TEXT, 381));
  v_customer_id := NULL;

  -- Scenario A: NUIT has precedence; otherwise use an exact, normalised name match.
  IF v_normalized_nuit IS NOT NULL THEN
    SELECT c.id
    INTO v_customer_id
    FROM public.customers c
    WHERE c.company_id = v_company_id
      AND c.active
      AND UPPER(regexp_replace(COALESCE(c.tax_number, ''), '\s+', '', 'g')) = v_normalized_nuit
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    SELECT c.id
    INTO v_customer_id
    FROM public.customers c
    WHERE c.company_id = v_company_id
      AND c.active
      AND LOWER(regexp_replace(TRIM(c.name), '\s+', ' ', 'g')) = v_normalized_name
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    RETURN v_customer_id;
  END IF;

  -- Scenario B: create one master record with the next numeric sequence. Codes such
  -- as CL-001 participate through their numeric suffix, while non-numeric codes do not.
  SELECT pt.id
  INTO v_payment_term_id
  FROM public.payment_terms pt
  WHERE pt.company_id = v_company_id
    AND pt.code = 'DINHEIRO'
    AND pt.active
  LIMIT 1;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      RAISE EXCEPTION 'CUSTOMER_NUMBER_ALLOCATION_FAILED';
    END IF;

    SELECT COALESCE(MAX((substring(TRIM(c.customer_number) FROM '([0-9]+)$'))::BIGINT), 0)
    INTO v_max_customer_number
    FROM public.customers c
    WHERE c.company_id = v_company_id
      AND TRIM(c.customer_number) ~ '[0-9]+$';

    v_next_customer_number := (v_max_customer_number + 1)::TEXT;

    BEGIN
      INSERT INTO public.customers (
        company_id,
        customer_number,
        name,
        tax_number,
        payment_term_id,
        credit_limit,
        opening_balance,
        current_balance,
        active,
        created_by,
        updated_by
      ) VALUES (
        v_company_id,
        v_next_customer_number,
        v_name,
        v_nuit,
        v_payment_term_id,
        0,
        0,
        0,
        true,
        auth.uid(),
        auth.uid()
      )
      RETURNING id INTO v_customer_id;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- A writer outside this helper may have used the same code. Recalculate safely.
      v_customer_id := NULL;
    END;
  END LOOP;

  IF v_address IS NOT NULL THEN
    INSERT INTO public.customer_addresses (
      company_id,
      customer_id,
      address_type,
      address_line_1,
      country_code,
      is_primary,
      active
    ) VALUES (
      v_company_id,
      v_customer_id,
      'GENERAL',
      v_address,
      'MZ',
      true,
      true
    );
  END IF;

  RETURN v_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_or_create_operational_customer(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_or_create_operational_customer(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_operational_document(
  p_document_id UUID,
  p_client_name TEXT DEFAULT NULL,
  p_client_nuit TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL,
  p_grand_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_notes TEXT;
  v_customer_id UUID;
  v_company_id UUID;
  v_updated_notes TEXT;
  v_new_name TEXT;
  v_new_nuit TEXT;
  v_new_address TEXT;
  v_extra_notes TEXT;
  v_final_grand NUMERIC;
  v_net NUMERIC;
  v_tax NUMERIC;
  v_line JSONB;
  v_idx INT := 1;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_disc_pct NUMERIC;
  v_disc_amt NUMERIC;
  v_iva_pct NUMERIC;
  v_line_tot NUMERIC;
  v_net_val NUMERIC;
  v_tax_val NUMERIC;
  v_prod_id UUID;
  v_prod_exists BOOLEAN;
BEGIN
  SELECT notes, customer_id, company_id, grand_total
  INTO v_existing_notes, v_customer_id, v_company_id, v_final_grand
  FROM public.documents
  WHERE id = p_document_id
    AND company_id = public.get_user_company_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;

  v_existing_notes := COALESCE(v_existing_notes, '');
  v_new_name := COALESCE(NULLIF(TRIM(p_client_name), ''), 'Cliente Pontual');
  v_new_nuit := COALESCE(NULLIF(TRIM(p_client_nuit), ''), 'N/A');
  v_new_address := COALESCE(NULLIF(TRIM(p_client_address), ''), 'N/A');
  v_extra_notes := COALESCE(TRIM(p_notes), '');

  v_updated_notes := TRIM(CONCAT(
    '[CLIENTE: ', v_new_name,
    ' | NUIT: ', v_new_nuit,
    ' | MORADA: ', v_new_address,
    '] ', v_extra_notes
  ));

  v_customer_id := public.resolve_or_create_operational_customer(
    v_customer_id,
    v_new_name,
    v_new_nuit,
    v_new_address
  );

  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    v_final_grand := 0;

    DELETE FROM public.document_lines WHERE document_id = p_document_id;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_qty := COALESCE((v_line->>'quantity')::NUMERIC, 1);
      v_price := COALESCE((v_line->>'unitPrice')::NUMERIC, 0);
      v_disc_pct := COALESCE((v_line->>'discountPercent')::NUMERIC, 0);
      v_iva_pct := COALESCE((v_line->>'ivaPercent')::NUMERIC, 16);

      v_line_tot := ROUND(v_qty * v_price * (1 - v_disc_pct / 100), 2);
      v_disc_amt := ROUND(v_qty * v_price * (v_disc_pct / 100), 2);
      v_net_val := ROUND(v_line_tot / (1 + v_iva_pct / 100), 2);
      v_tax_val := ROUND(v_line_tot - v_net_val, 2);
      v_final_grand := v_final_grand + v_line_tot;

      v_prod_id := NULL;
      BEGIN
        v_prod_id := (v_line->>'articleId')::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_prod_id := NULL;
      END;

      IF v_prod_id IS NOT NULL THEN
        SELECT EXISTS(
          SELECT 1
          FROM public.products
          WHERE id = v_prod_id AND company_id = v_company_id
        ) INTO v_prod_exists;
        IF NOT v_prod_exists THEN
          v_prod_id := NULL;
        END IF;
      END IF;

      INSERT INTO public.document_lines (
        document_id,
        company_id,
        line_number,
        product_id,
        product_code_snapshot,
        description_snapshot,
        unit_code_snapshot,
        quantity,
        unit_price,
        discount_percentage,
        discount_amount,
        tax_rate_snapshot,
        net_amount,
        tax_amount,
        total_amount
      ) VALUES (
        p_document_id,
        v_company_id,
        v_idx,
        v_prod_id,
        COALESCE(v_line->>'code', 'DIV'),
        COALESCE(v_line->>'description', 'Artigo sem descrição'),
        'UN',
        v_qty,
        v_price,
        v_disc_pct,
        v_disc_amt,
        v_iva_pct,
        v_net_val,
        v_tax_val,
        v_line_tot
      );

      v_idx := v_idx + 1;
    END LOOP;
  ELSIF p_grand_total IS NOT NULL AND p_grand_total >= 0 THEN
    v_final_grand := p_grand_total;
  END IF;

  v_net := ROUND(v_final_grand / 1.16, 2);
  v_tax := ROUND(v_final_grand - v_net, 2);

  UPDATE public.documents
  SET
    customer_id = v_customer_id,
    notes = v_updated_notes,
    grand_total = v_final_grand,
    net_total = v_net,
    tax_total = v_tax,
    outstanding_amount = v_final_grand,
    updated_at = NOW()
  WHERE id = p_document_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_operational_document(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operational_document(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, JSONB) TO authenticated;

COMMIT;
