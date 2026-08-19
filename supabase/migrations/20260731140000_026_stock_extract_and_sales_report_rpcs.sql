-- Migration: 20260731140000_026_stock_extract_and_sales_report_rpcs.sql
-- Purpose: Provide backend RPCs for Stock Movement Extract and Commercial/Financial Sales Reporting

BEGIN;

--------------------------------------------------------------------------------
-- 1. RPC: get_stock_movement_extract
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_stock_movement_extract(
    p_product_id UUID,
    p_from DATE DEFAULT NULL,
    p_to DATE DEFAULT NULL,
    p_movement_type TEXT DEFAULT 'ALL'
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
    v_opening_balance NUMERIC(18,3) := 0;
    v_current_stock NUMERIC(18,3) := 0;
    v_can_view_cost BOOLEAN := false;
    v_result JSONB;
BEGIN
    PERFORM public.require_operational_mode();

    IF auth.uid() IS NULL OR NOT (
        public.has_permission('stock.read')
        OR public.has_permission('stock.movements.read')
        OR public.has_permission('products.read')
    ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: stock.movements.read required';
    END IF;

    v_company_id := public.get_user_company_id();
    v_can_view_cost := public.has_permission('products.view_cost') OR public.has_permission('stock.cost.read');

    SELECT * INTO v_product
    FROM public.products
    WHERE id = p_product_id AND company_id = v_company_id AND is_active;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
    END IF;

    -- Compute physical current stock across accessible warehouses
    SELECT COALESCE(SUM(ib.quantity), 0) INTO v_current_stock
    FROM public.inventory_balances ib
    WHERE ib.product_id = p_product_id
      AND ib.company_id = v_company_id
      AND (
        public.has_warehouse_access(ib.warehouse_id)
        OR NOT EXISTS (SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid())
      );

    -- Compute opening balance prior to p_from
    IF p_from IS NOT NULL THEN
        SELECT COALESCE(SUM(sm.quantity_in - sm.quantity_out), 0) INTO v_opening_balance
        FROM public.stock_movements sm
        WHERE sm.product_id = p_product_id
          AND sm.company_id = v_company_id
          AND sm.created_at < p_from::TIMESTAMP
          AND (
            public.has_warehouse_access(sm.warehouse_id)
            OR NOT EXISTS (SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid())
          );
    END IF;

    -- Aggregate movement details chronologically with running balance
    WITH raw_movs AS (
        SELECT 
            sm.id,
            sm.created_at,
            sm.quantity_in,
            sm.quantity_out,
            sm.unit_cost,
            sm.movement_type,
            sm.legacy_ref,
            sm.reason,
            sm.source_document_id,
            d.display_number AS doc_display_number,
            dt.code AS doc_type_code,
            dt.name AS doc_type_name,
            u.full_name AS operator_name
        FROM public.stock_movements sm
        LEFT JOIN public.documents d ON d.id = sm.source_document_id
        LEFT JOIN public.document_types dt ON dt.id = d.document_type_id
        LEFT JOIN public.user_profiles u ON u.id = sm.created_by
        WHERE sm.product_id = p_product_id
          AND sm.company_id = v_company_id
          AND (p_from IS NULL OR sm.created_at >= p_from::TIMESTAMP)
          AND (p_to IS NULL OR sm.created_at <= (p_to + INTERVAL '1 day')::TIMESTAMP)
          AND (
            p_movement_type = 'ALL'
            OR (p_movement_type = 'ENTRADA' AND sm.quantity_in > 0)
            OR (p_movement_type = 'SAIDA' AND sm.quantity_out > 0)
          )
          AND (
            public.has_warehouse_access(sm.warehouse_id)
            OR NOT EXISTS (SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id = auth.uid())
          )
        ORDER BY sm.created_at ASC, sm.id ASC
    ),
    calculated AS (
        SELECT
            rm.*,
            v_opening_balance + SUM(rm.quantity_in - rm.quantity_out) OVER (ORDER BY rm.created_at ASC, rm.id ASC) AS running_balance,
            CASE WHEN rm.quantity_in > 0 THEN 'ENTRADA' ELSE 'SAÍDA' END AS movement_direction,
            COALESCE(rm.doc_display_number, rm.legacy_ref, 'M-DIRECT') AS doc_ref_label,
            COALESCE(rm.doc_type_code, 
                CASE WHEN rm.quantity_in > 0 THEN 'DIRECT_ENTRY' ELSE 'DIRECT_EXIT' END
            ) AS final_doc_type_code,
            COALESCE(rm.doc_type_name,
                CASE WHEN rm.quantity_in > 0 THEN 'Entrada Directa' ELSE 'Saída Directa' END
            ) AS final_doc_type_name
        FROM raw_movs rm
    )
    SELECT jsonb_build_object(
        'product_id', v_product.id,
        'product_code', v_product.code,
        'product_description', v_product.description,
        'unit', (SELECT abbreviation FROM public.units_of_measure WHERE id = v_product.unit_id),
        'opening_balance', v_opening_balance,
        'current_stock', v_current_stock,
        'avg_cost', CASE WHEN v_can_view_cost THEN v_product.avg_cost ELSE 0 END,
        'stock_valuation', CASE WHEN v_can_view_cost THEN (v_current_stock * v_product.avg_cost) ELSE 0 END,
        'can_view_cost', v_can_view_cost,
        'movements', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id,
                'created_at', c.created_at,
                'doc_ref', c.doc_ref_label,
                'source_document_id', c.source_document_id,
                'doc_type_code', c.final_doc_type_code,
                'doc_type_name', c.final_doc_type_name,
                'movement_direction', c.movement_direction,
                'quantity_in', c.quantity_in,
                'quantity_out', c.quantity_out,
                'unit_cost', CASE WHEN v_can_view_cost THEN c.unit_cost ELSE 0 END,
                'movement_value', CASE WHEN v_can_view_cost THEN (GREATEST(c.quantity_in, c.quantity_out) * c.unit_cost) ELSE 0 END,
                'running_balance', c.running_balance,
                'operator_name', COALESCE(c.operator_name, 'Sistema'),
                'reason', COALESCE(c.reason, '—')
            )) FROM calculated c
        ), '[]'::jsonb),
        'totals', jsonb_build_object(
            'total_in_qty', COALESCE((SELECT SUM(quantity_in) FROM calculated), 0),
            'total_out_qty', COALESCE((SELECT SUM(quantity_out) FROM calculated), 0),
            'total_in_val', CASE WHEN v_can_view_cost THEN COALESCE((SELECT SUM(quantity_in * unit_cost) FROM calculated), 0) ELSE 0 END,
            'total_out_val', CASE WHEN v_can_view_cost THEN COALESCE((SELECT SUM(quantity_out * unit_cost) FROM calculated), 0) ELSE 0 END
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stock_movement_extract(UUID, DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_movement_extract(UUID, DATE, DATE, TEXT) TO authenticated;


--------------------------------------------------------------------------------
-- 2. RPC: get_sales_operational_report_v2
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sales_operational_report_v2(
    p_from DATE DEFAULT NULL,
    p_to DATE DEFAULT NULL,
    p_doc_type TEXT DEFAULT 'ALL',
    p_payment_status TEXT DEFAULT 'ALL',
    p_customer_id UUID DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 1000,
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
    v_can_view_cost BOOLEAN := false;
    v_result JSONB;
BEGIN
    PERFORM public.require_operational_mode();

    IF auth.uid() IS NULL OR NOT (
        public.has_permission('reports.read')
        OR public.has_permission('reports.sales')
        OR public.has_permission('sales.reports.read')
    ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: sales.reports.read required';
    END IF;

    v_company_id := public.get_user_company_id();
    v_can_view_cost := public.has_permission('products.view_cost') OR public.has_permission('sales.margin.read');

    WITH filtered_docs AS (
        SELECT 
            d.id,
            d.display_number,
            d.document_date,
            d.status,
            d.customer_id,
            c.name AS customer_name,
            c.tax_number AS customer_nuit,
            dt.code AS doc_type_code,
            dt.name AS doc_type_name,
            d.subtotal,
            d.discount_total,
            d.tax_total,
            d.grand_total,
            d.amount_paid,
            d.outstanding_amount,
            u.full_name AS salesperson_name
        FROM public.documents d
        JOIN public.document_types dt ON dt.id = d.document_type_id
        LEFT JOIN public.customers c ON c.id = d.customer_id
        LEFT JOIN public.user_profiles u ON u.id = d.created_by
        WHERE d.company_id = v_company_id
          -- Include ONLY commercial sales documents & credit notes (Excludes Guia de Remessa!)
          AND dt.code IN ('CUSTOMER_INVOICE', 'CASH_SALE', 'CUSTOMER_CREDIT_NOTE')
          AND (p_from IS NULL OR d.document_date >= p_from)
          AND (p_to IS NULL OR d.document_date <= p_to)
          AND (p_doc_type = 'ALL' OR dt.code = p_doc_type)
          AND (p_customer_id IS NULL OR d.customer_id = p_customer_id)
          AND (
            p_payment_status = 'ALL'
            OR (p_payment_status = 'PAID' AND d.outstanding_amount = 0 AND d.status <> 'CANCELLED')
            OR (p_payment_status = 'PENDING' AND d.outstanding_amount = d.grand_total AND d.status <> 'CANCELLED')
            OR (p_payment_status = 'PARTIAL' AND d.outstanding_amount > 0 AND d.amount_paid > 0 AND d.status <> 'CANCELLED')
            OR (p_payment_status = 'CANCELLED' AND d.status IN ('CANCELLED', 'REVERSED'))
          )
          -- Filter out cancelled unless explicitly queried
          AND (p_payment_status = 'CANCELLED' OR d.status NOT IN ('CANCELLED', 'REVERSED'))
          AND (
            p_product_id IS NULL
            OR EXISTS (SELECT 1 FROM public.document_lines dl WHERE dl.document_id = d.id AND dl.product_id = p_product_id)
          )
          AND (
            public.has_branch_access(d.branch_id)
            OR NOT EXISTS (SELECT 1 FROM public.branch_access ba WHERE ba.user_id = auth.uid())
          )
    ),
    summary AS (
        SELECT
            COUNT(*) FILTER (WHERE doc_type_code = 'CUSTOMER_INVOICE') AS count_invoices,
            COUNT(*) FILTER (WHERE doc_type_code = 'CASH_SALE') AS count_vds,
            COUNT(*) FILTER (WHERE doc_type_code = 'CUSTOMER_CREDIT_NOTE') AS count_credits,
            
            COALESCE(SUM(grand_total) FILTER (WHERE doc_type_code IN ('CUSTOMER_INVOICE', 'CASH_SALE')), 0) AS gross_sales,
            COALESCE(SUM(grand_total) FILTER (WHERE doc_type_code = 'CUSTOMER_CREDIT_NOTE'), 0) AS credit_notes_total,
            
            COALESCE(SUM(subtotal) FILTER (WHERE doc_type_code IN ('CUSTOMER_INVOICE', 'CASH_SALE')), 0) AS total_subtotal,
            COALESCE(SUM(discount_total) FILTER (WHERE doc_type_code IN ('CUSTOMER_INVOICE', 'CASH_SALE')), 0) AS total_discount,
            COALESCE(SUM(tax_total) FILTER (WHERE doc_type_code IN ('CUSTOMER_INVOICE', 'CASH_SALE')), 0) AS total_tax,
            
            COALESCE(SUM(amount_paid) FILTER (WHERE doc_type_code IN ('CUSTOMER_INVOICE', 'CASH_SALE')), 0) AS total_paid,
            COALESCE(SUM(outstanding_amount) FILTER (WHERE doc_type_code IN ('CUSTOMER_INVOICE', 'CASH_SALE')), 0) AS total_pending
        FROM filtered_docs
    ),
    line_costs AS (
        SELECT 
            COALESCE(SUM(dl.quantity * dl.unit_cost_snapshot), 0) AS total_cost_of_goods
        FROM public.document_lines dl
        JOIN filtered_docs fd ON fd.id = dl.document_id
        WHERE fd.doc_type_code IN ('CUSTOMER_INVOICE', 'CASH_SALE')
    )
    SELECT jsonb_build_object(
        'can_view_cost', v_can_view_cost,
        'summary', (
            SELECT jsonb_build_object(
                'count_invoices', s.count_invoices,
                'count_vds', s.count_vds,
                'count_credits', s.count_credits,
                'gross_sales', s.gross_sales,
                'credit_notes_total', s.credit_notes_total,
                'net_sales', (s.gross_sales - s.credit_notes_total),
                'total_subtotal', s.total_subtotal,
                'total_discount', s.total_discount,
                'total_tax', s.total_tax,
                'total_paid', s.total_paid,
                'total_pending', s.total_pending,
                'total_cost_of_goods', CASE WHEN v_can_view_cost THEN lc.total_cost_of_goods ELSE 0 END,
                'gross_margin', CASE WHEN v_can_view_cost THEN ((s.gross_sales - s.credit_notes_total) - lc.total_cost_of_goods) ELSE 0 END,
                'gross_margin_pct', CASE WHEN v_can_view_cost AND (s.gross_sales - s.credit_notes_total) > 0 
                    THEN ROUND((((s.gross_sales - s.credit_notes_total) - lc.total_cost_of_goods) / (s.gross_sales - s.credit_notes_total) * 100), 2)
                    ELSE 0 END
            ) FROM summary s, line_costs lc
        ),
        'documents', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', fd.id,
                'display_number', fd.display_number,
                'document_date', fd.document_date,
                'doc_type_code', fd.doc_type_code,
                'doc_type_name', fd.doc_type_name,
                'customer_name', COALESCE(fd.customer_name, 'Cliente Pontual'),
                'customer_nuit', COALESCE(fd.customer_nuit, '—'),
                'salesperson_name', COALESCE(fd.salesperson_name, 'Sistema'),
                'subtotal', fd.subtotal,
                'discount_total', fd.discount_total,
                'tax_total', fd.tax_total,
                'grand_total', fd.grand_total,
                'amount_paid', fd.amount_paid,
                'outstanding_amount', fd.outstanding_amount,
                'status', fd.status
            ) ORDER BY fd.document_date DESC, fd.display_number DESC)
            FROM filtered_docs fd
            LIMIT LEAST(p_limit, 1000) OFFSET p_offset
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_operational_report_v2(DATE, DATE, TEXT, TEXT, UUID, UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_operational_report_v2(DATE, DATE, TEXT, TEXT, UUID, UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
