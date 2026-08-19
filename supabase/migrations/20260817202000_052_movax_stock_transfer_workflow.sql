-- MOVAX ERP / POS
-- Simple, auditable two-step warehouse transfer workflow:
-- PENDING -> IN_TRANSIT -> RECEIVED, with safe cancellation before receipt.

BEGIN;

-- The low-level movement primitive must not be callable directly by authenticated
-- clients with an arbitrary company_id. Business RPCs execute it as owner.
REVOKE ALL ON FUNCTION public.post_stock_movement(
  UUID, UUID, UUID, VARCHAR, NUMERIC, NUMERIC, NUMERIC,
  UUID, UUID, UUID, UUID, UUID, VARCHAR, UUID
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_stock_movement(
  UUID, UUID, UUID, VARCHAR, NUMERIC, NUMERIC, NUMERIC,
  UUID, UUID, UUID, UUID, UUID, VARCHAR, UUID
) FROM authenticated;

CREATE OR REPLACE FUNCTION public.create_stock_transfer_v1(
  p_from_warehouse_id UUID,
  p_to_warehouse_id UUID,
  p_transfer_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_transfer_id UUID;
  v_transfer_number TEXT;
  v_line JSONB;
  v_product_id UUID;
  v_quantity NUMERIC(15,3);
  v_line_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.has_permission('stock.transfer') THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.transfer'; END IF;
  IF NOT public.has_feature('ADVANCED_STOCK') THEN RAISE EXCEPTION 'FEATURE_NOT_LICENSED: ADVANCED_STOCK'; END IF;
  IF p_from_warehouse_id IS NULL OR p_to_warehouse_id IS NULL OR p_from_warehouse_id = p_to_warehouse_id THEN
    RAISE EXCEPTION 'TRANSFER_WAREHOUSES_INVALID';
  END IF;
  IF jsonb_typeof(COALESCE(p_lines, '[]'::JSONB)) <> 'array' OR jsonb_array_length(COALESCE(p_lines, '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION 'TRANSFER_LINES_REQUIRED';
  END IF;

  v_company_id := public.get_user_company_id();

  IF NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = p_from_warehouse_id AND w.company_id = v_company_id AND w.is_active) THEN
    RAISE EXCEPTION 'SOURCE_WAREHOUSE_INVALID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = p_to_warehouse_id AND w.company_id = v_company_id AND w.is_active) THEN
    RAISE EXCEPTION 'DESTINATION_WAREHOUSE_INVALID';
  END IF;
  IF NOT (public.has_warehouse_access(p_from_warehouse_id) OR public.has_permission('settings.manage')) THEN
    RAISE EXCEPTION 'SOURCE_WAREHOUSE_ACCESS_DENIED';
  END IF;
  IF NOT (public.has_warehouse_access(p_to_warehouse_id) OR public.has_permission('settings.manage')) THEN
    RAISE EXCEPTION 'DESTINATION_WAREHOUSE_ACCESS_DENIED';
  END IF;

  v_transfer_number := 'TRF-' || to_char(COALESCE(p_transfer_date, CURRENT_DATE), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 6));

  INSERT INTO public.stock_transfers (
    company_id, from_warehouse_id, to_warehouse_id, status,
    transfer_date, transfer_number, created_by, notes
  ) VALUES (
    v_company_id, p_from_warehouse_id, p_to_warehouse_id, 'PENDING',
    COALESCE(p_transfer_date, CURRENT_DATE), v_transfer_number, auth.uid(), NULLIF(TRIM(p_notes), '')
  ) RETURNING id INTO v_transfer_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    BEGIN
      v_product_id := NULLIF(v_line->>'product_id', '')::UUID;
      v_quantity := NULLIF(v_line->>'quantity', '')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'TRANSFER_LINE_INVALID';
    END;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'TRANSFER_LINE_INVALID';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = v_product_id AND p.company_id = v_company_id AND p.is_active) THEN
      RAISE EXCEPTION 'TRANSFER_PRODUCT_INVALID: %', v_product_id;
    END IF;

    INSERT INTO public.stock_transfer_lines (transfer_id, product_id, quantity, unit_cost)
    VALUES (v_transfer_id, v_product_id, v_quantity, 0)
    ON CONFLICT (transfer_id, product_id) DO UPDATE SET
      quantity = public.stock_transfer_lines.quantity + EXCLUDED.quantity;
    v_line_count := v_line_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_transfer_id,
    'transfer_number', v_transfer_number,
    'status', 'PENDING',
    'line_count', v_line_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_stock_transfer_v1(p_transfer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_transfer public.stock_transfers;
  v_line RECORD;
  v_cost NUMERIC(15,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.has_permission('stock.transfer') THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.transfer'; END IF;
  IF NOT public.has_feature('ADVANCED_STOCK') THEN RAISE EXCEPTION 'FEATURE_NOT_LICENSED: ADVANCED_STOCK'; END IF;
  v_company_id := public.get_user_company_id();

  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id = p_transfer_id AND company_id = v_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
  IF v_transfer.status <> 'PENDING' THEN RAISE EXCEPTION 'TRANSFER_NOT_PENDING'; END IF;
  IF NOT (public.has_warehouse_access(v_transfer.from_warehouse_id) OR public.has_permission('settings.manage')) THEN
    RAISE EXCEPTION 'SOURCE_WAREHOUSE_ACCESS_DENIED';
  END IF;

  FOR v_line IN
    SELECT stl.id, stl.product_id, stl.quantity,
           COALESCE(ib.avg_cost, p.avg_cost, 0)::NUMERIC(15,2) AS current_cost
    FROM public.stock_transfer_lines stl
    JOIN public.products p ON p.id = stl.product_id AND p.company_id = v_company_id
    LEFT JOIN public.inventory_balances ib
      ON ib.product_id = stl.product_id AND ib.warehouse_id = v_transfer.from_warehouse_id
    WHERE stl.transfer_id = v_transfer.id
    ORDER BY stl.product_id
  LOOP
    v_cost := COALESCE(v_line.current_cost, 0);
    PERFORM public.post_stock_movement(
      v_company_id, v_line.product_id, v_transfer.from_warehouse_id,
      'stock_transfer_out', 0, v_line.quantity, v_cost,
      NULL, NULL, NULL, NULL, NULL, v_transfer.transfer_number, NULL
    );
    UPDATE public.stock_transfer_lines SET unit_cost = v_cost WHERE id = v_line.id;
  END LOOP;

  UPDATE public.stock_transfers
  SET status = 'IN_TRANSIT', dispatched_by = auth.uid(), dispatched_at = now(), updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object('id', v_transfer.id, 'transfer_number', v_transfer.transfer_number, 'status', 'IN_TRANSIT');
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_stock_transfer_v1(p_transfer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_transfer public.stock_transfers;
  v_line RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.has_permission('stock.transfer') THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.transfer'; END IF;
  IF NOT public.has_feature('ADVANCED_STOCK') THEN RAISE EXCEPTION 'FEATURE_NOT_LICENSED: ADVANCED_STOCK'; END IF;
  v_company_id := public.get_user_company_id();

  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id = p_transfer_id AND company_id = v_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
  IF v_transfer.status <> 'IN_TRANSIT' THEN RAISE EXCEPTION 'TRANSFER_NOT_IN_TRANSIT'; END IF;
  IF NOT (public.has_warehouse_access(v_transfer.to_warehouse_id) OR public.has_permission('settings.manage')) THEN
    RAISE EXCEPTION 'DESTINATION_WAREHOUSE_ACCESS_DENIED';
  END IF;

  FOR v_line IN
    SELECT product_id, quantity, unit_cost
    FROM public.stock_transfer_lines
    WHERE transfer_id = v_transfer.id
    ORDER BY product_id
  LOOP
    PERFORM public.post_stock_movement(
      v_company_id, v_line.product_id, v_transfer.to_warehouse_id,
      'stock_transfer_in', v_line.quantity, 0, COALESCE(v_line.unit_cost, 0),
      NULL, NULL, NULL, NULL, NULL, v_transfer.transfer_number, NULL
    );
  END LOOP;

  UPDATE public.stock_transfers
  SET status = 'RECEIVED', received_by = auth.uid(), received_at = now(), updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object('id', v_transfer.id, 'transfer_number', v_transfer.transfer_number, 'status', 'RECEIVED');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_stock_transfer_v1(p_transfer_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_transfer public.stock_transfers;
  v_line RECORD;
  v_note TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.has_permission('stock.transfer') THEN RAISE EXCEPTION 'PERMISSION_DENIED: stock.transfer'; END IF;
  v_company_id := public.get_user_company_id();

  SELECT * INTO v_transfer
  FROM public.stock_transfers
  WHERE id = p_transfer_id AND company_id = v_company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
  IF v_transfer.status = 'RECEIVED' THEN RAISE EXCEPTION 'RECEIVED_TRANSFER_CANNOT_BE_CANCELLED'; END IF;
  IF v_transfer.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('id', v_transfer.id, 'transfer_number', v_transfer.transfer_number, 'status', 'CANCELLED');
  END IF;
  IF NOT (public.has_warehouse_access(v_transfer.from_warehouse_id) OR public.has_permission('settings.manage')) THEN
    RAISE EXCEPTION 'SOURCE_WAREHOUSE_ACCESS_DENIED';
  END IF;

  IF v_transfer.status = 'IN_TRANSIT' THEN
    FOR v_line IN
      SELECT product_id, quantity, unit_cost
      FROM public.stock_transfer_lines
      WHERE transfer_id = v_transfer.id
      ORDER BY product_id
    LOOP
      PERFORM public.post_stock_movement(
        v_company_id, v_line.product_id, v_transfer.from_warehouse_id,
        'reversal', v_line.quantity, 0, COALESCE(v_line.unit_cost, 0),
        NULL, NULL, NULL, NULL, NULL, 'REV-' || v_transfer.transfer_number, NULL
      );
    END LOOP;
  END IF;

  v_note := concat_ws(E'\n', NULLIF(v_transfer.notes, ''), 'Cancelamento: ' || COALESCE(NULLIF(TRIM(p_reason), ''), 'Sem motivo indicado'));
  UPDATE public.stock_transfers
  SET status = 'CANCELLED', cancelled_by = auth.uid(), cancelled_at = now(), notes = v_note, updated_at = now()
  WHERE id = v_transfer.id;

  RETURN jsonb_build_object('id', v_transfer.id, 'transfer_number', v_transfer.transfer_number, 'status', 'CANCELLED');
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_transfer_v1(UUID,UUID,DATE,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_stock_transfer_v1(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.receive_stock_transfer_v1(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_stock_transfer_v1(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer_v1(UUID,UUID,DATE,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_stock_transfer_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_stock_transfer_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_transfer_v1(UUID,TEXT) TO authenticated;

COMMIT;
