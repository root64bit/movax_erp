BEGIN;

-- Code 1 is reserved for Cliente Pontual. AUTO COMPANY LDA was imported with
-- the ambiguous historical code 01, so assign the next available numeric code
-- without changing the customer ID, documents, movements or account balance.
DO $$
DECLARE
  v_company_id UUID;
  v_customer_id UUID;
  v_next_number TEXT;
BEGIN
  SELECT c.company_id, c.id
  INTO v_company_id, v_customer_id
  FROM public.customers c
  WHERE LOWER(TRIM(c.name)) = 'auto company lda'
    AND TRIM(c.customer_number) = '01'
  ORDER BY c.created_at
  LIMIT 1
  FOR UPDATE;

  IF v_customer_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_company_id::TEXT, 381));

    SELECT (COALESCE(MAX((substring(TRIM(c.customer_number) FROM '([0-9]+)$'))::BIGINT), 0) + 1)::TEXT
    INTO v_next_number
    FROM public.customers c
    WHERE c.company_id = v_company_id
      AND TRIM(c.customer_number) ~ '[0-9]+$';

    UPDATE public.customers
    SET customer_number = v_next_number,
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;
END;
$$;

COMMIT;
