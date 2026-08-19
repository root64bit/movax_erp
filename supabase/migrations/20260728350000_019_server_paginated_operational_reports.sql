BEGIN;

CREATE OR REPLACE FUNCTION public.get_operational_report(
  p_report TEXT,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
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
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 1000);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_permission('reports.read')
    OR public.has_permission('reports.' || p_report)
    OR (p_report = 'vat' AND public.has_permission('reports.tax'))
  ) THEN RAISE EXCEPTION 'PERMISSION_DENIED: reports.read'; END IF;
  IF p_report NOT IN ('sales','vat','stock','receivables','payables') THEN
    RAISE EXCEPTION 'INVALID_REPORT';
  END IF;
  v_company_id := public.get_user_company_id();

  IF p_report IN ('sales','vat') THEN
    WITH filtered AS (
      SELECT d.id, d.display_number AS document, d.document_date AS date,
             COALESCE(c.name, '') AS party, d.net_total AS net,
             d.tax_total AS tax, d.grand_total AS total,
             d.outstanding_amount AS outstanding, d.status
      FROM public.documents d
      JOIN public.document_types dt ON dt.id = d.document_type_id
      LEFT JOIN public.customers c ON c.id = d.customer_id
      WHERE d.company_id = v_company_id AND dt.party_type = 'CUSTOMER'
        AND (p_from IS NULL OR d.document_date >= p_from)
        AND (p_to IS NULL OR d.document_date <= p_to)
        AND (public.has_branch_access(d.branch_id)
          OR NOT EXISTS (SELECT 1 FROM public.branch_access ba WHERE ba.user_id = auth.uid()))
    ), page AS (
      SELECT * FROM filtered ORDER BY date DESC, document DESC LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb),
      'total_count', (SELECT count(*) FROM filtered),
      'totals', jsonb_build_object(
        'net', COALESCE((SELECT sum(net) FROM filtered),0),
        'tax', COALESCE((SELECT sum(tax) FROM filtered),0),
        'total', COALESCE((SELECT sum(total) FROM filtered),0),
        'outstanding', COALESCE((SELECT sum(outstanding) FROM filtered),0)
      )
    ) INTO v_result;
  ELSIF p_report = 'stock' THEN
    WITH filtered AS (
      SELECT p.id, p.code, p.description, COALESCE(u.abbreviation,'') AS unit,
             COALESCE(sum(ib.quantity) FILTER (
               WHERE public.has_warehouse_access(ib.warehouse_id)
                 OR NOT EXISTS (SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid())
             ),0) AS quantity,
             p.min_stock, p.sale_price_incl AS price
      FROM public.products p
      LEFT JOIN public.units_of_measure u ON u.id = p.unit_id
      LEFT JOIN public.inventory_balances ib ON ib.product_id = p.id
      WHERE p.company_id = v_company_id AND p.is_active
      GROUP BY p.id, u.abbreviation
    ), page AS (
      SELECT * FROM filtered ORDER BY code LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb),
      'total_count', (SELECT count(*) FROM filtered),
      'totals', jsonb_build_object('quantity', COALESCE((SELECT sum(quantity) FROM filtered),0))
    ) INTO v_result;
  ELSIF p_report = 'receivables' THEN
    WITH filtered AS (
      SELECT id, name AS party, COALESCE(tax_number,'') AS tax_number,
             current_balance AS balance
      FROM public.customers
      WHERE company_id = v_company_id AND active AND current_balance > 0
    ), page AS (
      SELECT * FROM filtered ORDER BY party LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb),
      'total_count', (SELECT count(*) FROM filtered),
      'totals', jsonb_build_object('balance', COALESCE((SELECT sum(balance) FROM filtered),0))
    ) INTO v_result;
  ELSE
    WITH filtered AS (
      SELECT id, name AS party, COALESCE(tax_number,'') AS tax_number,
             current_balance AS balance
      FROM public.suppliers
      WHERE company_id = v_company_id AND active AND current_balance > 0
    ), page AS (
      SELECT * FROM filtered ORDER BY party LIMIT v_limit OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb),
      'total_count', (SELECT count(*) FROM filtered),
      'totals', jsonb_build_object('balance', COALESCE((SELECT sum(balance) FROM filtered),0))
    ) INTO v_result;
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_operational_report(TEXT, DATE, DATE, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_operational_report(TEXT, DATE, DATE, INTEGER, INTEGER) TO authenticated;

COMMIT;
