-- Migration: 20260728190000_004_stock_engine.sql
-- Description: Inventory balances, transactional stock movements, movement reasons, inventory counts, stock transfers, and atomic stock posting RPC.
-- Target Database: bkbcgndzsfylwsinxwbb (Production Pre-Live Mode)

BEGIN;

-- 1. INVENTORY BALANCES (Real-time product stock per warehouse)
CREATE TABLE IF NOT EXISTS public.inventory_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    quantity NUMERIC(15,3) NOT NULL DEFAULT 0,
    avg_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (avg_cost >= 0),
    last_movement_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_warehouse UNIQUE (product_id, warehouse_id)
);

ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.inventory_balances TO authenticated;
GRANT ALL ON public.inventory_balances TO service_role;

CREATE POLICY "inventory_balances_select" ON public.inventory_balances
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 2. STOCK MOVEMENT REASONS
CREATE TABLE IF NOT EXISTS public.stock_movement_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stock_reason_code UNIQUE (company_id, code)
);

ALTER TABLE public.stock_movement_reasons ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.stock_movement_reasons TO authenticated;
GRANT ALL ON public.stock_movement_reasons TO service_role;

CREATE POLICY "stock_movement_reasons_select" ON public.stock_movement_reasons
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 3. STOCK MOVEMENTS (Immutable ledger of all physical stock movements)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'opening_stock', 'direct_entry', 'direct_exit', 'purchase_entry', 'sales_exit',
        'customer_return', 'supplier_return', 'stock_correction', 'stock_transfer_out',
        'stock_transfer_in', 'reversal', 'inventory_adjustment'
    )),
    source_document_id UUID,
    source_document_line_id UUID,
    quantity_in NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (quantity_in >= 0),
    quantity_out NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (quantity_out >= 0),
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    balance_after NUMERIC(15,3) NOT NULL DEFAULT 0,
    reason_id UUID REFERENCES public.stock_movement_reasons(id) ON DELETE SET NULL,
    customer_id UUID,
    supplier_id UUID,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    legacy_ref VARCHAR(100),
    migration_batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_stock_movement_qty CHECK (quantity_in > 0 OR quantity_out > 0)
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

CREATE POLICY "stock_movements_select" ON public.stock_movements
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 4. INVENTORY COUNTS
CREATE TABLE IF NOT EXISTS public.inventory_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    confirmed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.inventory_counts TO authenticated;
GRANT ALL ON public.inventory_counts TO service_role;

CREATE POLICY "inventory_counts_select" ON public.inventory_counts
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 5. INVENTORY COUNT LINES
CREATE TABLE IF NOT EXISTS public.inventory_count_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id UUID NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    system_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
    counted_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
    variance NUMERIC(15,3) NOT NULL DEFAULT 0, -- counted_qty - system_qty
    adjustment_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
    CONSTRAINT uq_count_line_product UNIQUE (count_id, product_id)
);

ALTER TABLE public.inventory_count_lines ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.inventory_count_lines TO authenticated;
GRANT ALL ON public.inventory_count_lines TO service_role;

CREATE POLICY "inventory_count_lines_select" ON public.inventory_count_lines
    FOR SELECT TO authenticated USING (
        count_id IN (SELECT id FROM public.inventory_counts WHERE company_id = public.get_user_company_id())
    );

-- 6. STOCK TRANSFERS (Inter-warehouse transfer)
CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'received', 'cancelled')),
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_different_warehouses CHECK (from_warehouse_id <> to_warehouse_id)
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;

CREATE POLICY "stock_transfers_select" ON public.stock_transfers
    FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());

-- 7. STOCK TRANSFER LINES
CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity NUMERIC(15,3) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    CONSTRAINT uq_transfer_line_product UNIQUE (transfer_id, product_id)
);

ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.stock_transfer_lines TO authenticated;
GRANT ALL ON public.stock_transfer_lines TO service_role;

CREATE POLICY "stock_transfer_lines_select" ON public.stock_transfer_lines
    FOR SELECT TO authenticated USING (
        transfer_id IN (SELECT id FROM public.stock_transfers WHERE company_id = public.get_user_company_id())
    );

-- ────────────────────────────────────────────────────────────
-- TRANSACTIONAL STOCK POSTING RPC PROCEDURE (SECURITY DEFINER)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.post_stock_movement(
    p_company_id UUID,
    p_product_id UUID,
    p_warehouse_id UUID,
    p_movement_type VARCHAR(50),
    p_quantity_in NUMERIC(15,3),
    p_quantity_out NUMERIC(15,3),
    p_unit_cost NUMERIC(15,2),
    p_source_document_id UUID DEFAULT NULL,
    p_source_document_line_id UUID DEFAULT NULL,
    p_reason_id UUID DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL,
    p_supplier_id UUID DEFAULT NULL,
    p_legacy_ref VARCHAR(100) DEFAULT NULL,
    p_migration_batch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_qty NUMERIC(15,3) := 0;
    v_current_avg_cost NUMERIC(15,2) := 0;
    v_new_qty NUMERIC(15,3) := 0;
    v_new_avg_cost NUMERIC(15,2) := 0;
    v_total_cost NUMERIC(15,2) := 0;
    v_movement_id UUID;
    v_allow_negative BOOLEAN := false;
BEGIN
    -- Check negative stock policy
    SELECT COALESCE(setting_value = 'true', false) INTO v_allow_negative
    FROM public.company_settings
    WHERE company_id = p_company_id AND setting_key = 'ALLOW_NEGATIVE_STOCK';

    -- Lock & Fetch current balance
    SELECT quantity, avg_cost INTO v_current_qty, v_current_avg_cost
    FROM public.inventory_balances
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_current_qty := 0;
        v_current_avg_cost := 0;
    END IF;

    -- Calculate new balance
    v_new_qty := v_current_qty + COALESCE(p_quantity_in, 0) - COALESCE(p_quantity_out, 0);

    -- Enforce non-negative stock policy unless explicitly allowed or override permission exists
    IF v_new_qty < 0 AND NOT v_allow_negative AND NOT public.has_permission('stock.allow_negative') THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Current balance is %, requested exit is %. Negative stock is disabled.', v_current_qty, p_quantity_out;
    END IF;

    -- Calculate weighted average cost if stock entry
    IF COALESCE(p_quantity_in, 0) > 0 THEN
        v_total_cost := ROUND(p_quantity_in * p_unit_cost, 2);
        IF (v_current_qty + p_quantity_in) > 0 THEN
            v_new_avg_cost := ROUND(((v_current_qty * v_current_avg_cost) + v_total_cost) / (v_current_qty + p_quantity_in), 2);
        ELSE
            v_new_avg_cost := p_unit_cost;
        END IF;
    ELSE
        v_total_cost := ROUND(p_quantity_out * v_current_avg_cost, 2);
        v_new_avg_cost := v_current_avg_cost;
    END IF;

    -- Insert immutable stock_movement record
    INSERT INTO public.stock_movements (
        company_id,
        product_id,
        warehouse_id,
        movement_type,
        source_document_id,
        source_document_line_id,
        quantity_in,
        quantity_out,
        unit_cost,
        total_cost,
        balance_after,
        reason_id,
        customer_id,
        supplier_id,
        user_id,
        legacy_ref,
        migration_batch_id
    ) VALUES (
        p_company_id,
        p_product_id,
        p_warehouse_id,
        p_movement_type,
        p_source_document_id,
        p_source_document_line_id,
        COALESCE(p_quantity_in, 0),
        COALESCE(p_quantity_out, 0),
        CASE WHEN COALESCE(p_quantity_in, 0) > 0 THEN p_unit_cost ELSE v_current_avg_cost END,
        v_total_cost,
        v_new_qty,
        p_reason_id,
        p_customer_id,
        p_supplier_id,
        auth.uid(),
        p_legacy_ref,
        p_migration_batch_id
    ) RETURNING id INTO v_movement_id;

    -- Upsert inventory_balances
    INSERT INTO public.inventory_balances (
        company_id,
        product_id,
        warehouse_id,
        quantity,
        avg_cost,
        last_movement_at
    ) VALUES (
        p_company_id,
        p_product_id,
        p_warehouse_id,
        v_new_qty,
        v_new_avg_cost,
        now()
    )
    ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
        quantity = EXCLUDED.quantity,
        avg_cost = EXCLUDED.avg_cost,
        last_movement_at = EXCLUDED.last_movement_at;

    -- Update products catalog avg_cost
    UPDATE public.products
    SET avg_cost = v_new_avg_cost,
        last_purchase_cost = CASE WHEN COALESCE(p_quantity_in, 0) > 0 THEN p_unit_cost ELSE last_purchase_cost END,
        updated_at = now()
    WHERE id = p_product_id;

    RETURN v_movement_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- SEED DATA: STOCK MOVEMENT REASONS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.stock_movement_reasons (company_id, movement_type, code, description) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'direct_entry', 'ENT_DIR', 'Entrada Directa Manual'),
    ('a0000000-0000-0000-0000-000000000001', 'direct_exit', 'SAI_DIR', 'Saída Directa Manual'),
    ('a0000000-0000-0000-0000-000000000001', 'inventory_adjustment', 'AJUSTE_POS', 'Ajuste Positivo de Inventário (Contagem)'),
    ('a0000000-0000-0000-0000-000000000001', 'inventory_adjustment', 'AJUSTE_NEG', 'Ajuste Negativo de Inventário (Contagem)'),
    ('a0000000-0000-0000-0000-000000000001', 'direct_exit', 'DETERIORA', 'Artigo Danificado / Deteriorado'),
    ('a0000000-0000-0000-0000-000000000001', 'direct_exit', 'OFERTA', 'Oferta / Amostra Comercial')
ON CONFLICT (company_id, code) DO NOTHING;

COMMIT;
