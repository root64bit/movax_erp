-- MOVAX ERP / POS
-- Fast tenant-safe article lookup for POS, stock guides and transfers.
-- Designed for catalogues with tens of thousands of SKUs without loading the full catalogue in the browser.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_products_company_active_barcode
ON public.products(company_id, is_active, barcode)
WHERE barcode IS NOT NULL;

CREATE OR REPLACE FUNCTION public.search_stock_products_v1(
  p_search TEXT,
  p_warehouse_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 40
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100);
  v_query TEXT := TRIM(COALESCE(p_search, ''));
  v_can_view_cost BOOLEAN;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT (
    public.has_permission('products.read')
    OR public.has_permission('products.view')
    OR public.has_permission('stock.read')
    OR public.has_permission('stock.view')
    OR public.has_permission('sales.create')
    OR public.has_permission('purchases.create')
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: products.read';
  END IF;

  v_company_id := public.get_user_company_id();
  v_can_view_cost := public.has_permission('products.view_cost');

  IF p_warehouse_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.warehouses w
      WHERE w.id = p_warehouse_id
        AND w.company_id = v_company_id
        AND w.is_active
    ) THEN
      RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';
    END IF;
    IF NOT (public.has_warehouse_access(p_warehouse_id) OR public.has_permission('settings.manage')) THEN
      RAISE EXCEPTION 'WAREHOUSE_ACCESS_DENIED';
    END IF;
  END IF;

  WITH stock AS (
    SELECT ib.product_id, SUM(ib.quantity)::NUMERIC AS quantity
    FROM public.inventory_balances ib
    WHERE ib.company_id = v_company_id
      AND (
        (p_warehouse_id IS NOT NULL AND ib.warehouse_id = p_warehouse_id)
        OR (
          p_warehouse_id IS NULL
          AND (
            public.has_warehouse_access(ib.warehouse_id)
            OR NOT EXISTS (SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid())
          )
        )
      )
    GROUP BY ib.product_id
  ), ranked AS (
    SELECT
      p.id,
      p.code,
      p.barcode,
      p.description,
      p.min_stock,
      COALESCE(s.quantity, 0)::NUMERIC AS stock,
      CASE WHEN v_can_view_cost THEN p.avg_cost ELSE 0 END::NUMERIC AS avg_cost,
      p.profit_pct,
      p.sale_price_excl,
      p.sale_price_incl,
      p.tax_code_id,
      COALESCE(tc.rate, 0)::NUMERIC AS tax_rate,
      pc.id AS category_id,
      COALESCE(pc.name, 'Geral') AS category_name,
      b.id AS brand_id,
      COALESCE(b.name, '') AS brand_name,
      u.id AS unit_id,
      COALESCE(u.abbreviation, 'UN') AS unit,
      CASE
        WHEN v_query <> '' AND UPPER(p.code) = UPPER(v_query) THEN 0
        WHEN v_query <> '' AND COALESCE(p.barcode, '') = v_query THEN 0
        WHEN v_query <> '' AND UPPER(p.code) LIKE UPPER(v_query) || '%' THEN 1
        WHEN v_query <> '' AND COALESCE(p.barcode, '') LIKE v_query || '%' THEN 1
        WHEN v_query <> '' AND p.description ILIKE v_query || '%' THEN 2
        ELSE 3
      END AS match_rank
    FROM public.products p
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN public.product_categories pc ON pc.id = p.category_id
    LEFT JOIN public.brands b ON b.id = p.brand_id
    LEFT JOIN public.units_of_measure u ON u.id = p.unit_id
    LEFT JOIN public.tax_codes tc ON tc.id = p.tax_code_id
    WHERE p.company_id = v_company_id
      AND p.is_active
      AND (
        v_query = ''
        OR p.code ILIKE '%' || v_query || '%'
        OR COALESCE(p.barcode, '') ILIKE '%' || v_query || '%'
        OR p.description ILIKE '%' || v_query || '%'
        OR COALESCE(b.name, '') ILIKE '%' || v_query || '%'
      )
    ORDER BY match_rank, p.code, p.id
    LIMIT v_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'code', code,
    'barcode', barcode,
    'description', description,
    'min_stock', min_stock,
    'stock', stock,
    'avg_cost', avg_cost,
    'profit_pct', profit_pct,
    'sale_price_excl', sale_price_excl,
    'sale_price_incl', sale_price_incl,
    'tax_code_id', tax_code_id,
    'tax_rate', tax_rate,
    'category_id', category_id,
    'category_name', category_name,
    'brand_id', brand_id,
    'brand_name', brand_name,
    'unit_id', unit_id,
    'unit', unit
  ) ORDER BY match_rank, code), '[]'::JSONB)
  INTO v_result
  FROM ranked;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.search_stock_products_v1(TEXT,UUID,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_stock_products_v1(TEXT,UUID,INTEGER) TO authenticated;

COMMIT;
