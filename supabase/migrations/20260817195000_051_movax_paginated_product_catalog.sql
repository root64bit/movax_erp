-- MOVAX ERP / POS
-- Server-side product catalogue pagination for large catalogues (20k+ products).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_products_company_active_code
ON public.products(company_id, is_active, code);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_company_product
ON public.inventory_balances(company_id, product_id);

CREATE INDEX IF NOT EXISTS idx_document_lines_company_product
ON public.document_lines(company_id, product_id)
WHERE product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_products_page_v1(
  p_search TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_stock_filter TEXT DEFAULT 'ALL',
  p_sort TEXT DEFAULT 'CODE',
  p_code_from TEXT DEFAULT NULL,
  p_code_to TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  v_can_view_cost BOOLEAN;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT (
    public.has_permission('products.read')
    OR public.has_permission('products.view')
    OR public.has_permission('stock.read')
    OR public.has_permission('stock.view')
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: products.read';
  END IF;

  v_company_id := public.get_user_company_id();
  v_can_view_cost := public.has_permission('products.view_cost');

  WITH accessible_stock AS (
    SELECT ib.product_id, SUM(ib.quantity)::NUMERIC AS stock
    FROM public.inventory_balances ib
    WHERE ib.company_id = v_company_id
      AND (
        public.has_warehouse_access(ib.warehouse_id)
        OR NOT EXISTS (
          SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid()
        )
      )
    GROUP BY ib.product_id
  ),
  sold AS (
    SELECT dl.product_id, SUM(dl.quantity)::NUMERIC AS sold_qty
    FROM public.document_lines dl
    JOIN public.documents d ON d.id = dl.document_id
    JOIN public.document_types dt ON dt.id = d.document_type_id
    WHERE dl.company_id = v_company_id
      AND dl.product_id IS NOT NULL
      AND dt.party_type = 'CUSTOMER'
      AND d.status NOT IN ('DRAFT','CANCELLED','REVERSED')
    GROUP BY dl.product_id
  ),
  base AS (
    SELECT
      p.id,
      p.code,
      p.description,
      COALESCE(u.abbreviation, 'UN') AS unit,
      p.min_stock,
      COALESCE(s.stock, 0)::NUMERIC AS stock,
      CASE WHEN v_can_view_cost THEN p.avg_cost ELSE 0 END::NUMERIC AS avg_cost,
      CASE WHEN v_can_view_cost THEN p.profit_pct ELSE 0 END::NUMERIC AS profit_pct,
      p.sale_price_excl,
      p.sale_price_incl,
      p.tax_code_id,
      COALESCE(tc.rate, 0)::NUMERIC AS tax_rate,
      pc.id AS category_id,
      COALESCE(pc.name, 'Geral') AS category_name,
      b.id AS brand_id,
      COALESCE(b.name, '') AS brand_name,
      u.id AS unit_id,
      COALESCE(sd.sold_qty, 0)::NUMERIC AS sold_qty
    FROM public.products p
    LEFT JOIN accessible_stock s ON s.product_id = p.id
    LEFT JOIN sold sd ON sd.product_id = p.id
    LEFT JOIN public.product_categories pc ON pc.id = p.category_id
    LEFT JOIN public.brands b ON b.id = p.brand_id
    LEFT JOIN public.units_of_measure u ON u.id = p.unit_id
    LEFT JOIN public.tax_codes tc ON tc.id = p.tax_code_id
    WHERE p.company_id = v_company_id
      AND p.is_active
      AND (
        NULLIF(TRIM(COALESCE(p_search, '')), '') IS NULL
        OR p.code ILIKE '%' || TRIM(p_search) || '%'
        OR p.description ILIKE '%' || TRIM(p_search) || '%'
        OR COALESCE(b.name, '') ILIKE '%' || TRIM(p_search) || '%'
        OR COALESCE(p.barcode, '') ILIKE '%' || TRIM(p_search) || '%'
      )
      AND (
        NULLIF(TRIM(COALESCE(p_category, '')), '') IS NULL
        OR LOWER(COALESCE(pc.name, 'Geral')) = LOWER(TRIM(p_category))
      )
      AND (NULLIF(TRIM(COALESCE(p_code_from, '')), '') IS NULL OR UPPER(p.code) >= UPPER(TRIM(p_code_from)))
      AND (NULLIF(TRIM(COALESCE(p_code_to, '')), '') IS NULL OR UPPER(p.code) <= UPPER(TRIM(p_code_to)))
      AND CASE UPPER(COALESCE(p_stock_filter, 'ALL'))
        WHEN 'WITH_STOCK' THEN COALESCE(s.stock, 0) > 0
        WHEN 'NO_STOCK' THEN COALESCE(s.stock, 0) <= 0
        WHEN 'LOW_STOCK' THEN COALESCE(s.stock, 0) <= p.min_stock
        ELSE true
      END
  ),
  page AS (
    SELECT *
    FROM base
    ORDER BY
      CASE WHEN UPPER(COALESCE(p_sort, 'CODE')) = 'MOST_SOLD' THEN sold_qty END DESC NULLS LAST,
      CASE WHEN UPPER(COALESCE(p_sort, 'CODE')) = 'STOCK_ASC' THEN stock END ASC NULLS LAST,
      CASE WHEN UPPER(COALESCE(p_sort, 'CODE')) = 'STOCK_DESC' THEN stock END DESC NULLS LAST,
      code ASC,
      id ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'code', code,
        'description', description,
        'unit', unit,
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
        'sold_qty', sold_qty
      )) FROM page
    ), '[]'::JSONB),
    'total_count', (SELECT COUNT(*) FROM base),
    'totals', jsonb_build_object(
      'stock_qty', COALESCE((SELECT SUM(stock) FROM base), 0),
      'stock_cost_value', CASE WHEN v_can_view_cost THEN COALESCE((SELECT SUM(stock * avg_cost) FROM base), 0) ELSE 0 END,
      'stock_sale_value', COALESCE((SELECT SUM(stock * sale_price_incl) FROM base), 0),
      'low_stock_count', (SELECT COUNT(*) FROM base WHERE stock <= min_stock),
      'out_of_stock_count', (SELECT COUNT(*) FROM base WHERE stock <= 0)
    ),
    'can_view_cost', v_can_view_cost,
    'limit', v_limit,
    'offset', v_offset
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_products_page_v1(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_products_page_v1(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER) TO authenticated;

COMMIT;
