BEGIN;

DROP FUNCTION IF EXISTS public.create_and_confirm_customer_payment(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_and_confirm_customer_sale(UUID, DATE, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.post_operational_stock_movement(UUID, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.create_operational_product(JSONB);
DROP FUNCTION IF EXISTS public.require_operational_mode();

COMMIT;
