-- Fix trigger function for custom services and non-stock items in document_lines
CREATE OR REPLACE FUNCTION public.enforce_document_line_inventory_tracking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tracks_inventory BOOLEAN;
BEGIN
  -- If product_id is NULL (custom service / non-stock item), disable stock effect and return cleanly
  IF NEW.product_id IS NULL THEN
    NEW.stock_effect_enabled := false;
    RETURN NEW;
  END IF;

  SELECT tracks_inventory
  INTO v_tracks_inventory
  FROM public.products
  WHERE id = NEW.product_id
    AND company_id = NEW.company_id;

  IF NOT FOUND THEN
    -- If product is not found in catalog, disable stock effect instead of raising an error
    NEW.stock_effect_enabled := false;
    RETURN NEW;
  END IF;

  IF NOT v_tracks_inventory THEN
    NEW.stock_effect_enabled := false;
  END IF;

  RETURN NEW;
END;
$$;
