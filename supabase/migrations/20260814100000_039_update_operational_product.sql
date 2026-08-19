CREATE OR REPLACE FUNCTION public.update_operational_product_v2(p_product jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_code TEXT;
  v_desc TEXT;
BEGIN
  v_product_id := (p_product->>'id')::UUID;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_ID_REQUIRED';
  END IF;

  -- Get company_id from existing product
  SELECT company_id INTO v_company_id FROM public.products WHERE id = v_product_id;
  IF v_company_id IS NULL THEN
    v_company_id := public.get_user_company_id();
  END IF;
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  END IF;

  v_code := UPPER(TRIM(p_product->>'code'));
  v_desc := TRIM(p_product->>'description');

  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'PRODUCT_CODE_REQUIRED';
  END IF;
  IF v_desc IS NULL OR v_desc = '' THEN
    RAISE EXCEPTION 'PRODUCT_DESCRIPTION_REQUIRED';
  END IF;

  v_category_id := NULLIF(p_product->>'category_id', '')::UUID;
  v_brand_id := NULLIF(p_product->>'brand_id', '')::UUID;
  v_unit_id := NULLIF(p_product->>'unit_id', '')::UUID;
  v_tax_code_id := NULLIF(p_product->>'tax_code_id', '')::UUID;
  v_category_name := NULLIF(TRIM(p_product->>'category_name'), '');
  v_brand_name := NULLIF(TRIM(p_product->>'brand_name'), '');

  IF v_brand_name IS NULL AND p_product->>'brand' IS NOT NULL THEN
    v_brand_name := NULLIF(TRIM(p_product->>'brand'), '');
  END IF;

  -- 1. Handle Category: if custom category name is passed or category_id is missing
  IF v_category_name IS NOT NULL THEN
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

  -- 2. Handle Brand: if custom brand name is passed or brand_id is missing
  IF v_brand_name IS NOT NULL THEN
    SELECT id INTO v_brand_id FROM public.brands
    WHERE company_id = v_company_id AND LOWER(name) = LOWER(v_brand_name)
    LIMIT 1;

    IF v_brand_id IS NULL THEN
      INSERT INTO public.brands (company_id, name)
      VALUES (v_company_id, v_brand_name)
      RETURNING id INTO v_brand_id;
    END IF;
  END IF;

  -- 3. Unit fallback
  IF v_unit_id IS NULL THEN
    SELECT id INTO v_unit_id FROM public.units_of_measure
    WHERE company_id = v_company_id AND (code = 'UN' OR abbreviation = 'UN' OR name ILIKE '%UNIDADE%')
    LIMIT 1;
  END IF;

  -- 4. Tax Code fallback
  IF v_tax_code_id IS NULL THEN
    SELECT id INTO v_tax_code_id FROM public.tax_codes
    WHERE company_id = v_company_id AND is_active ORDER BY rate DESC, code LIMIT 1;
  END IF;

  -- 5. Perform the UPDATE on products table
  UPDATE public.products
  SET
    code = v_code,
    description = v_desc,
    category_id = v_category_id,
    brand_id = v_brand_id,
    unit_id = COALESCE(v_unit_id, unit_id),
    tax_code_id = COALESCE(v_tax_code_id, tax_code_id),
    min_stock = COALESCE((p_product->>'min_stock')::NUMERIC, min_stock),
    avg_cost = COALESCE((p_product->>'cost_price')::NUMERIC, avg_cost),
    profit_pct = COALESCE((p_product->>'profit_margin')::NUMERIC, profit_pct),
    sale_price_excl = COALESCE((p_product->>'sale_price_excl')::NUMERIC, sale_price_excl),
    sale_price_incl = COALESCE((p_product->>'sale_price_incl')::NUMERIC, sale_price_incl),
    notes = COALESCE(NULLIF(TRIM(p_product->>'notes'), ''), notes),
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE id = v_product_id AND company_id = v_company_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_operational_product_v2(jsonb) TO authenticated, anon;
