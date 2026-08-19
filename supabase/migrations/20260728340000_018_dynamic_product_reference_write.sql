BEGIN;

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
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT public.has_permission('products.create') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: products.create';
  END IF;
  v_company_id := public.get_user_company_id();
  v_category_id := NULLIF(p_product->>'category_id', '')::UUID;
  v_brand_id := NULLIF(p_product->>'brand_id', '')::UUID;
  v_unit_id := NULLIF(p_product->>'unit_id', '')::UUID;

  IF v_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_categories WHERE id = v_category_id AND company_id = v_company_id
  ) THEN RAISE EXCEPTION 'INVALID_PRODUCT_CATEGORY'; END IF;
  IF v_brand_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.brands WHERE id = v_brand_id AND company_id = v_company_id
  ) THEN RAISE EXCEPTION 'INVALID_PRODUCT_BRAND'; END IF;
  IF v_unit_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.units_of_measure WHERE id = v_unit_id AND company_id = v_company_id
  ) THEN RAISE EXCEPTION 'INVALID_UNIT_OF_MEASURE'; END IF;

  SELECT id INTO v_tax_code_id FROM public.tax_codes
  WHERE company_id = v_company_id AND is_active ORDER BY rate DESC, code LIMIT 1;
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
