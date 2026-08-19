-- Seed Reference Data for Casa de Pneus (Mozambique Context)

-- Assuming a predefined Company ID for seed script
DO $$
DECLARE
    sys_company_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN

    -- Insert Default Company if not exists
    INSERT INTO companies (id, name, tax_number, address)
    VALUES (sys_company_id, 'Casa de Pneus, Lda', '123456789', 'Maputo, Mozambique')
    ON CONFLICT (id) DO NOTHING;

    -- Insert Tax Codes (IVA MZ)
    INSERT INTO tax_codes (company_id, code, description, rate) VALUES
    (sys_company_id, 'IVA16', 'IVA Normal 16%', 16.00),
    (sys_company_id, 'ISE', 'Isento', 0.00)
    ON CONFLICT DO NOTHING;

    -- Insert Document Types
    INSERT INTO document_types (company_id, code, name, category, affects_stock, affects_ledger) VALUES
    (sys_company_id, 'FT', 'Fatura', 'customer', TRUE, TRUE),
    (sys_company_id, 'FR', 'Fatura-Recibo', 'customer', TRUE, TRUE),
    (sys_company_id, 'NC', 'Nota de Crédito', 'customer', TRUE, TRUE),
    (sys_company_id, 'GT', 'Guia de Transporte', 'customer', TRUE, FALSE),
    (sys_company_id, 'V/FT', 'Fatura de Fornecedor', 'supplier', TRUE, TRUE)
    ON CONFLICT DO NOTHING;

END $$;
