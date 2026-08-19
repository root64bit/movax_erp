BEGIN;

-- Return a complete, reconciled extract for one product. Historical imports may
-- contain exits without their original entries; the reconciliation opening is
-- therefore derived without changing any stored movement or current balance.
CREATE OR REPLACE FUNCTION public.get_stock_movement_extract_v2(
  p_product_id UUID,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_movement_type TEXT DEFAULT 'ALL',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_product public.products;
  v_current_stock NUMERIC(18,3) := 0;
  v_movement_net NUMERIC(18,3) := 0;
  v_reconciliation_opening NUMERIC(18,3) := 0;
  v_opening_balance NUMERIC(18,3) := 0;
  v_can_view_cost BOOLEAN := false;
  v_result JSONB;
  v_limit INTEGER:=LEAST(GREATEST(COALESCE(p_limit,100),1),200);
  v_offset INTEGER:=GREATEST(COALESCE(p_offset,0),0);
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT (
    public.has_permission('stock.read') OR public.has_permission('stock.movements.read') OR public.has_permission('products.read')
  ) THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.movements.read required'; END IF;

  v_company_id:=public.get_user_company_id();
  v_can_view_cost:=public.has_permission('products.view_cost') OR public.has_permission('stock.cost.read');
  SELECT * INTO v_product FROM public.products
  WHERE id=p_product_id AND company_id=v_company_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;

  SELECT COALESCE(SUM(ib.quantity),0) INTO v_current_stock
  FROM public.inventory_balances ib
  WHERE ib.product_id=p_product_id AND ib.company_id=v_company_id
    AND (public.has_warehouse_access(ib.warehouse_id)
      OR NOT EXISTS(SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid()));

  SELECT COALESCE(SUM(sm.quantity_in-sm.quantity_out),0) INTO v_movement_net
  FROM public.stock_movements sm
  WHERE sm.product_id=p_product_id AND sm.company_id=v_company_id
    AND (public.has_warehouse_access(sm.warehouse_id)
      OR NOT EXISTS(SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid()));

  v_reconciliation_opening:=v_current_stock-v_movement_net;
  SELECT v_reconciliation_opening+COALESCE(SUM(sm.quantity_in-sm.quantity_out),0) INTO v_opening_balance
  FROM public.stock_movements sm
  WHERE sm.product_id=p_product_id AND sm.company_id=v_company_id
    AND p_from IS NOT NULL AND sm.created_at<(p_from::TIMESTAMP AT TIME ZONE 'Africa/Maputo')
    AND (public.has_warehouse_access(sm.warehouse_id)
      OR NOT EXISTS(SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid()));

  WITH all_movements AS (
    SELECT sm.id,sm.created_at,sm.quantity_in,sm.quantity_out,sm.unit_cost,sm.movement_type,
      sm.legacy_ref,mr.description AS reason,sm.source_document_id,d.display_number AS doc_display_number,
      dt.code AS doc_type_code,dt.name AS doc_type_name,u.full_name AS operator_name,
      v_reconciliation_opening+SUM(sm.quantity_in-sm.quantity_out) OVER(ORDER BY sm.created_at,sm.id) AS running_balance
    FROM public.stock_movements sm
    LEFT JOIN public.documents d ON d.id=sm.source_document_id
    LEFT JOIN public.document_types dt ON dt.id=d.document_type_id
    LEFT JOIN public.user_profiles u ON u.id=sm.user_id
    LEFT JOIN public.stock_movement_reasons mr ON mr.id=sm.reason_id
    WHERE sm.product_id=p_product_id AND sm.company_id=v_company_id
      AND (public.has_warehouse_access(sm.warehouse_id)
        OR NOT EXISTS(SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid()))
  ), filtered AS MATERIALIZED (
    SELECT am.* FROM all_movements am
    WHERE (p_from IS NULL OR am.created_at>=(p_from::TIMESTAMP AT TIME ZONE 'Africa/Maputo'))
      AND (p_to IS NULL OR am.created_at<((p_to+1)::TIMESTAMP AT TIME ZONE 'Africa/Maputo'))
      AND (UPPER(COALESCE(p_movement_type,'ALL'))='ALL'
        OR (UPPER(p_movement_type)='ENTRADA' AND am.quantity_in>0)
        OR (UPPER(p_movement_type) IN('SAIDA','SAÍDA') AND am.quantity_out>0))
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY created_at,id LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'product_id',v_product.id,'product_code',v_product.code,'product_description',v_product.description,
    'unit',(SELECT abbreviation FROM public.units_of_measure WHERE id=v_product.unit_id),
    'reconciliation_opening',v_reconciliation_opening,'opening_balance',v_opening_balance,
    'current_stock',v_current_stock,'avg_cost',CASE WHEN v_can_view_cost THEN v_product.avg_cost ELSE 0 END,
    'stock_valuation',CASE WHEN v_can_view_cost THEN v_current_stock*v_product.avg_cost ELSE 0 END,
    'can_view_cost',v_can_view_cost,'movement_count',(SELECT COUNT(*) FROM filtered),
    'limit',v_limit,'offset',v_offset,
    'movements',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',f.id,'created_at',f.created_at,'doc_ref',COALESCE(f.doc_display_number,f.legacy_ref,'M-DIRECT'),
      'source_document_id',f.source_document_id,'doc_type_code',COALESCE(f.doc_type_code,CASE WHEN f.quantity_in>0 THEN 'DIRECT_ENTRY' ELSE 'DIRECT_EXIT' END),
      'doc_type_name',COALESCE(f.doc_type_name,CASE WHEN f.quantity_in>0 THEN 'Entrada Directa' ELSE 'Saída Directa' END),
      'movement_direction',CASE WHEN f.quantity_in>0 THEN 'ENTRADA' ELSE 'SAÍDA' END,
      'quantity_in',f.quantity_in,'quantity_out',f.quantity_out,
      'unit_cost',CASE WHEN v_can_view_cost THEN f.unit_cost ELSE 0 END,
      'movement_value',CASE WHEN v_can_view_cost THEN GREATEST(f.quantity_in,f.quantity_out)*f.unit_cost ELSE 0 END,
      'running_balance',f.running_balance,'operator_name',COALESCE(f.operator_name,'Sistema'),'reason',COALESCE(f.reason,'—')
    ) ORDER BY f.created_at,f.id) FROM page_rows f),'[]'::JSONB),
    'totals',jsonb_build_object(
      'total_in_qty',COALESCE((SELECT SUM(quantity_in) FROM filtered),0),
      'total_out_qty',COALESCE((SELECT SUM(quantity_out) FROM filtered),0),
      'total_in_val',CASE WHEN v_can_view_cost THEN COALESCE((SELECT SUM(quantity_in*unit_cost) FROM filtered),0) ELSE 0 END,
      'total_out_val',CASE WHEN v_can_view_cost THEN COALESCE((SELECT SUM(quantity_out*unit_cost) FROM filtered),0) ELSE 0 END
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- Server-side history page used by the main movement table. Balances are computed
-- before date/type/search filters, so a filtered row still shows its true stock saldo.
CREATE OR REPLACE FUNCTION public.get_stock_movements_page_v2(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_movement_type TEXT DEFAULT 'ALL',
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_limit INTEGER:=LEAST(GREATEST(COALESCE(p_limit,25),1),200);
  v_offset INTEGER:=GREATEST(COALESCE(p_offset,0),0);
  v_search TEXT:=LOWER(TRIM(COALESCE(p_search,'')));
  v_result JSONB;
  v_has_warehouse_restriction BOOLEAN:=false;
  v_can_view_cost BOOLEAN:=false;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL OR NOT (
    public.has_permission('stock.read') OR public.has_permission('stock.movements.read') OR public.has_permission('products.read')
  ) THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.movements.read required'; END IF;
  v_company_id:=public.get_user_company_id();
  v_can_view_cost:=public.has_permission('products.view_cost') OR public.has_permission('stock.cost.read');
  SELECT EXISTS(SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid())
  INTO v_has_warehouse_restriction;

  WITH filtered AS MATERIALIZED (
    SELECT sm.id,sm.product_id,sm.warehouse_id,sm.user_id,sm.reason_id,sm.created_at,
      sm.quantity_in,sm.quantity_out,sm.unit_cost,sm.movement_type,sm.legacy_ref,sm.source_document_id,
      p.code AS product_code,p.description AS product_description
    FROM public.stock_movements sm
    JOIN public.products p ON p.id=sm.product_id AND p.company_id=v_company_id AND p.is_active
    LEFT JOIN public.documents search_doc ON search_doc.id=sm.source_document_id AND v_search<>''
    LEFT JOIN public.user_profiles search_user ON search_user.id=sm.user_id AND v_search<>''
    WHERE sm.company_id=v_company_id
      AND (NOT v_has_warehouse_restriction OR EXISTS(
        SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid() AND wa.warehouse_id=sm.warehouse_id
      ))
      AND (p_from IS NULL OR sm.created_at>=(p_from::TIMESTAMP AT TIME ZONE 'Africa/Maputo'))
      AND (p_to IS NULL OR sm.created_at<((p_to+1)::TIMESTAMP AT TIME ZONE 'Africa/Maputo'))
      AND (UPPER(COALESCE(p_movement_type,'ALL'))='ALL'
        OR (UPPER(p_movement_type)='ENTRADA' AND sm.quantity_in>0)
        OR (UPPER(p_movement_type) IN('SAIDA','SAÍDA') AND sm.quantity_out>0))
      AND (v_search=''
        OR (v_search~'^[0-9]+$' AND
          COALESCE(NULLIF(LTRIM(regexp_replace(p.code,'\D','','g'),'0'),''),'0')=
          COALESCE(NULLIF(LTRIM(v_search,'0'),''),'0'))
        OR (v_search!~'^[0-9]+$' AND (
          LOWER(p.code) LIKE '%'||v_search||'%'
          OR LOWER(p.description) LIKE '%'||v_search||'%'
          OR LOWER(COALESCE(search_doc.display_number,sm.legacy_ref,'')) LIKE '%'||v_search||'%'
          OR LOWER(COALESCE(search_user.full_name,'')) LIKE '%'||v_search||'%'
        )))
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT v_limit OFFSET v_offset
  ), page_enriched AS (
    SELECT pr.*,d.display_number AS document_number,dt.code AS document_type_code,dt.name AS document_type_name,
      u.full_name AS operator_name,w.name AS warehouse_name,mr.description AS reason,
      COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_balances ib
        WHERE ib.product_id=pr.product_id AND ib.company_id=v_company_id
          AND (NOT v_has_warehouse_restriction OR EXISTS(
            SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid() AND wa.warehouse_id=ib.warehouse_id
          ))),0)-COALESCE((
        SELECT SUM(newer.quantity_in-newer.quantity_out)
        FROM public.stock_movements newer
        WHERE newer.product_id=pr.product_id
          AND newer.company_id=v_company_id
          AND (newer.created_at,newer.id)>(pr.created_at,pr.id)
          AND (NOT v_has_warehouse_restriction OR EXISTS(
            SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid() AND wa.warehouse_id=newer.warehouse_id
          ))
      ),0) AS balance_after
    FROM page_rows pr
    LEFT JOIN public.documents d ON d.id=pr.source_document_id
    LEFT JOIN public.document_types dt ON dt.id=d.document_type_id
    LEFT JOIN public.user_profiles u ON u.id=pr.user_id
    LEFT JOIN public.stock_movement_reasons mr ON mr.id=pr.reason_id
    LEFT JOIN public.warehouses w ON w.id=pr.warehouse_id
  )
  SELECT jsonb_build_object(
    'total_count',(SELECT COUNT(*) FROM filtered),
    'total_stock',COALESCE((SELECT SUM(ib.quantity) FROM public.inventory_balances ib
      JOIN public.products stock_product ON stock_product.id=ib.product_id
        AND stock_product.company_id=v_company_id AND stock_product.is_active
      WHERE ib.company_id=v_company_id AND (NOT v_has_warehouse_restriction OR EXISTS(
        SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid() AND wa.warehouse_id=ib.warehouse_id
      ))),0),
    'limit',v_limit,'offset',v_offset,
    'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',r.id,'product_id',r.product_id,'product_code',r.product_code,'product_description',r.product_description,
      'created_at',r.created_at,'movement_direction',CASE WHEN r.quantity_in>0 THEN 'ENTRADA' ELSE 'SAÍDA' END,
      'quantity_in',r.quantity_in,'quantity_out',r.quantity_out,'balance_after',r.balance_after,
      'unit_cost',CASE WHEN v_can_view_cost THEN r.unit_cost ELSE 0 END,'source_document_id',r.source_document_id,
      'doc_ref',COALESCE(r.document_number,r.legacy_ref,CASE WHEN r.quantity_in>0 THEN 'Entrada Directa' ELSE 'Saída Directa' END),
      'doc_type_code',COALESCE(r.document_type_code,CASE WHEN r.quantity_in>0 THEN 'DIRECT_ENTRY' ELSE 'DIRECT_EXIT' END),
      'doc_type_name',COALESCE(r.document_type_name,CASE WHEN r.quantity_in>0 THEN 'Entrada Directa' ELSE 'Saída Directa' END),
      'operator_name',COALESCE(r.operator_name,'Sistema'),'warehouse_id',r.warehouse_id,'warehouse_name',r.warehouse_name,
      'reason',COALESCE(r.reason,'—')
    ) ORDER BY r.created_at DESC,r.id DESC) FROM page_enriched r),'[]'::JSONB)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stock_movement_extract_v2(UUID,DATE,DATE,TEXT,INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_movement_extract_v2(UUID,DATE,DATE,TEXT,INTEGER,INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.get_stock_movements_page_v2(DATE,DATE,TEXT,TEXT,INTEGER,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_movements_page_v2(DATE,DATE,TEXT,TEXT,INTEGER,INTEGER) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_stock_movements_company_product_created
  ON public.stock_movements(company_id,product_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_created
  ON public.stock_movements(company_id,created_at DESC,id DESC);

COMMIT;
