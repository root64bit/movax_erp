-- MOVAX ERP / POS
-- Migration: 20260819120000_059_multicurrency_valuation_lots_and_bank.sql
-- Purpose: Multicurrency purchases with manual exchange rates, valuation algorithms (PMP/FIFO/LIFO),
--          lot/serial tracking, bank reconciliation (baixa de banco), and Enterprise Business API keys.

BEGIN;

-- 1. Multicurrency in Documents & Lines
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'MZN',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,6) DEFAULT 1.000000,
  ADD COLUMN IF NOT EXISTS foreign_total NUMERIC(18,2);

ALTER TABLE public.document_lines
  ADD COLUMN IF NOT EXISTS unit_cost_foreign NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,6) DEFAULT 1.000000;

-- 2. Valuation Method Configuration per Company
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(10) DEFAULT 'PMP'; -- 'PMP', 'FIFO', 'LIFO'

-- 3. Product Lots & Expiration
CREATE TABLE IF NOT EXISTS public.product_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  lot_number VARCHAR(100) NOT NULL,
  manufacture_date DATE,
  expiration_date DATE,
  initial_quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  remaining_quantity NUMERIC(15,4) NOT NULL DEFAULT 0,
  unit_cost_mzn NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'MZN',
  exchange_rate NUMERIC(15,6) DEFAULT 1.000000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_lot UNIQUE (company_id, product_id, lot_number)
);

ALTER TABLE public.product_lots ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.product_lots TO authenticated;

DROP POLICY IF EXISTS product_lots_isolation ON public.product_lots;
CREATE POLICY product_lots_isolation ON public.product_lots
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 4. Product Serial Numbers
CREATE TABLE IF NOT EXISTS public.product_serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  lot_id UUID REFERENCES public.product_lots(id) ON DELETE SET NULL,
  serial_number VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'SOLD', 'DEFECTIVE', 'RETURNED'
  sold_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  sold_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_serial UNIQUE (company_id, product_id, serial_number)
);

ALTER TABLE public.product_serial_numbers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.product_serial_numbers TO authenticated;

DROP POLICY IF EXISTS product_serials_isolation ON public.product_serial_numbers;
CREATE POLICY product_serials_isolation ON public.product_serial_numbers
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 5. Bank Reconciliation (Baixa de Banco)
CREATE TABLE IF NOT EXISTS public.bank_statement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_name VARCHAR(100) NOT NULL DEFAULT 'BIM',
  account_number VARCHAR(50),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value_date DATE,
  description TEXT NOT NULL,
  reference_number VARCHAR(100),
  amount_mzn NUMERIC(18,2) NOT NULL,
  movement_type VARCHAR(10) NOT NULL, -- 'CREDIT' (Recebimento / Depósito) ou 'DEBIT' (Pagamento / Saída)
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RECONCILED', 'IGNORED'
  reconciled_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  reconciled_party_type VARCHAR(20), -- 'CUSTOMER' ou 'SUPPLIER'
  reconciled_party_id UUID,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statement_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.bank_statement_entries TO authenticated;

DROP POLICY IF EXISTS bank_statement_isolation ON public.bank_statement_entries;
CREATE POLICY bank_statement_isolation ON public.bank_statement_entries
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 6. RPC: Reconcile Bank Statement Entry (Baixa de Banco)
CREATE OR REPLACE FUNCTION public.reconcile_bank_statement_entry_v1(
  p_entry_id UUID,
  p_document_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_entry public.bank_statement_entries;
  v_doc public.documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  v_company_id := public.get_user_company_id();

  SELECT * INTO v_entry FROM public.bank_statement_entries
  WHERE id = p_entry_id AND company_id = v_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENTRY_NOT_FOUND'; END IF;

  IF p_document_id IS NOT NULL THEN
    SELECT * INTO v_doc FROM public.documents
    WHERE id = p_document_id AND company_id = v_company_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;

    -- Update Document Paid Amount if applicable
    UPDATE public.documents
    SET paid_amount = LEAST(grand_total, paid_amount + v_entry.amount_mzn),
        outstanding_amount = GREATEST(0, grand_total - (paid_amount + v_entry.amount_mzn)),
        status = CASE WHEN (paid_amount + v_entry.amount_mzn) >= grand_total THEN 'CONFIRMED' ELSE status END
    WHERE id = v_doc.id;
  END IF;

  -- Mark bank entry as reconciled
  UPDATE public.bank_statement_entries
  SET status = 'RECONCILED',
      reconciled_document_id = p_document_id,
      reconciled_at = now(),
      reconciled_by = auth.uid(),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = v_entry.id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry.id,
    'status', 'RECONCILED',
    'document_id', p_document_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_bank_statement_entry_v1(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_bank_statement_entry_v1(UUID, UUID, TEXT) TO authenticated;

-- 7. Business API Keys (Enterprise)
CREATE TABLE IF NOT EXISTS public.tenant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key_label VARCHAR(100) NOT NULL,
  api_key_prefix VARCHAR(12) NOT NULL,
  api_key_hash VARCHAR(128) NOT NULL,
  allowed_modules TEXT[] DEFAULT ARRAY['SALES', 'STOCK', 'CATALOG'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_api_key_prefix UNIQUE (api_key_prefix)
);

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tenant_api_keys TO authenticated;

DROP POLICY IF EXISTS tenant_api_keys_isolation ON public.tenant_api_keys;
CREATE POLICY tenant_api_keys_isolation ON public.tenant_api_keys
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 8. Add Business API & Addons in Subscription Plans
UPDATE public.subscription_plans
SET included_features = ARRAY['CORE', 'ADVANCED_STOCK', 'PURCHASES', 'FINANCIAL', 'BI_PRO', 'MULTI_BRANCH', 'SECURITY_PRO', 'BUSINESS_API', 'BACKUP_PRO']
WHERE code = 'ENTERPRISE';

COMMIT;
