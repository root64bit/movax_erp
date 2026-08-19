BEGIN;

-- Update create_operational_product_v2 to accept optional tax_code_id, category_name, and brand_name from the frontend.
-- Automatically inserts new product_category or brand if custom text is provided by user.
CREATE OR REPLACE FUNCTION public.create_operational_product_v2(p_product JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_product_id UUID;
  v_category_id UUID;
  v_brand_id UUID;
  v_unit_id UUID;
  v_tax_code_id UUID;
  v_category_name TEXT;
  v_brand_name TEXT;
  v_family_id UUID;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT public.has_permission('products.create') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: products.create';
  END IF;
  v_company_id := public.get_user_company_id();
  v_category_id := NULLIF(p_product->>'category_id', '')::UUID;
  v_brand_id := NULLIF(p_product->>'brand_id', '')::UUID;
  v_unit_id := NULLIF(p_product->>'unit_id', '')::UUID;
  v_tax_code_id := NULLIF(p_product->>'tax_code_id', '')::UUID;
  v_category_name := NULLIF(TRIM(p_product->>'category_name'), '');
  v_brand_name := NULLIF(TRIM(p_product->>'brand_name'), '');

  -- Handle Category by Name if ID is missing or if name is passed
  IF v_category_id IS NULL AND v_category_name IS NOT NULL THEN
    SELECT id INTO v_category_id FROM public.product_categories
    WHERE company_id = v_company_id AND LOWER(name) = LOWER(v_category_name)
    LIMIT 1;

    IF v_category_id IS NULL THEN
      SELECT id INTO v_family_id FROM public.product_families
      WHERE company_id = v_company_id ORDER BY created_at LIMIT 1;

      INSERT INTO public.product_categories (company_id, family_id, code, name)
      VALUES (
        v_company_id,
        COALESCE(v_family_id, '1f000000-0000-0000-0000-000000000001'::UUID),
        UPPER(SUBSTRING(REGEXP_REPLACE(v_category_name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 8)) || '_' || FLOOR(RANDOM() * 10000)::TEXT,
        v_category_name
      ) RETURNING id INTO v_category_id;
    END IF;
  END IF;

  -- Handle Brand by Name if ID is missing or if name is passed
  IF v_brand_id IS NULL AND v_brand_name IS NOT NULL THEN
    SELECT id INTO v_brand_id FROM public.brands
    WHERE company_id = v_company_id AND LOWER(name) = LOWER(v_brand_name)
    LIMIT 1;

    IF v_brand_id IS NULL THEN
      INSERT INTO public.brands (company_id, name)
      VALUES (v_company_id, v_brand_name)
      RETURNING id INTO v_brand_id;
    END IF;
  END IF;

  IF v_unit_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.units_of_measure WHERE id = v_unit_id AND company_id = v_company_id
  ) THEN RAISE EXCEPTION 'INVALID_UNIT_OF_MEASURE'; END IF;

  -- Validate provided tax_code_id or fall back to default
  IF v_tax_code_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tax_codes WHERE id = v_tax_code_id AND company_id = v_company_id AND is_active
    ) THEN RAISE EXCEPTION 'INVALID_TAX_CODE'; END IF;
  ELSE
    SELECT id INTO v_tax_code_id FROM public.tax_codes
    WHERE company_id = v_company_id AND is_active ORDER BY rate DESC, code LIMIT 1;
  END IF;
  IF v_tax_code_id IS NULL THEN RAISE EXCEPTION 'ACTIVE_TAX_CODE_REQUIRED'; END IF;

  INSERT INTO public.products (
    company_id, code, description, category_id, brand_id, unit_id, tax_code_id,
    min_stock, avg_cost, profit_pct, sale_price_excl, sale_price_incl, notes,
    created_by, updated_by
  ) VALUES (
    v_company_id, UPPER(TRIM(p_product->>'code')), TRIM(p_product->>'description'),
    v_category_id, v_brand_id, v_unit_id, v_tax_code_id,
    COALESCE((p_product->>'min_stock')::NUMERIC, 0),
    COALESCE((p_product->>'cost_price')::NUMERIC, 0),
    COALESCE((p_product->>'profit_margin')::NUMERIC, 0),
    COALESCE((p_product->>'sale_price_excl')::NUMERIC, 0),
    COALESCE((p_product->>'sale_price_incl')::NUMERIC, 0),
    NULLIF(TRIM(p_product->>'notes'), ''), auth.uid(), auth.uid()
  ) RETURNING id INTO v_product_id;
  RETURN v_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_operational_product_v2(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_operational_product_v2(JSONB) TO authenticated;

COMMIT;
