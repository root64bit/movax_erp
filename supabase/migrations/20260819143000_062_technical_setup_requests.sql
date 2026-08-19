-- MOVAX ERP / POS
-- Migration: 20260819143000_062_technical_setup_requests.sql
-- Purpose: Create technical setup requests table for assisted add-ons

BEGIN;

CREATE TABLE IF NOT EXISTS public.technical_setup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  addon_code TEXT NOT NULL,
  addon_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  preferred_date DATE,
  notes TEXT,
  setup_fee NUMERIC(15,2) DEFAULT 0,
  monthly_fee NUMERIC(15,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'M_PESA',
  payment_reference TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_technical_setup_company ON public.technical_setup_requests(company_id);

-- RLS
ALTER TABLE public.technical_setup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_technical_setup_select" ON public.technical_setup_requests
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_technical_setup_insert" ON public.technical_setup_requests
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

COMMIT;
