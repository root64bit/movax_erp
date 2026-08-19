BEGIN;

-- Real credit notes are always linked to an invoice and reduce the corresponding account.
UPDATE public.document_types SET
  name='Nota de Crédito a Cliente', requires_source_document=true,
  affects_customer_account=true, affects_stock=false, stock_direction='IN', active=true
WHERE code='CUSTOMER_CREDIT_NOTE';

UPDATE public.document_types SET
  name='Nota de Crédito de Fornecedor', requires_source_document=true,
  affects_supplier_account=true, affects_stock=false, stock_direction='OUT', active=true
WHERE code='SUPPLIER_CREDIT_ADVICE';

CREATE TABLE IF NOT EXISTS public.financial_advice_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  advice_document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  target_document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(18,2) NOT NULL CHECK(allocated_amount>0),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.user_profiles(id),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES public.user_profiles(id)
);
ALTER TABLE public.financial_advice_allocations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE public.financial_advice_allocations ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE public.financial_advice_allocations ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.user_profiles(id);
ALTER TABLE public.financial_advice_allocations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.financial_advice_allocations TO authenticated;
GRANT ALL ON public.financial_advice_allocations TO service_role;
DROP POLICY IF EXISTS financial_advice_allocations_select ON public.financial_advice_allocations;
CREATE POLICY financial_advice_allocations_select ON public.financial_advice_allocations
  FOR SELECT TO authenticated USING(company_id=public.get_user_company_id());
CREATE INDEX IF NOT EXISTS idx_financial_advice_target_active
  ON public.financial_advice_allocations(target_document_id,status);

CREATE OR REPLACE FUNCTION private.refresh_document_payment_status(p_document_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_doc public.documents; v_paid NUMERIC(18,2); v_credit NUMERIC(18,2); v_out NUMERIC(18,2); v_status TEXT;
  v_type TEXT; v_allocated NUMERIC(18,2):=0;
BEGIN
  SELECT * INTO v_doc FROM public.documents WHERE id=p_document_id FOR UPDATE;
  IF NOT FOUND OR v_doc.status IN('CANCELLED','REVERSED') THEN RETURN; END IF;
  SELECT code INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  SELECT COALESCE(SUM(amount),0) INTO v_allocated FROM public.payment_allocations
    WHERE document_id=p_document_id AND status='ACTIVE';
  IF v_type='CASH_SALE' OR (v_doc.amount_paid>=v_doc.grand_total AND v_allocated=0) THEN v_paid:=v_doc.grand_total;
  ELSE v_paid:=v_allocated; END IF;
  SELECT COALESCE(SUM(allocated_amount),0) INTO v_credit FROM public.financial_advice_allocations
    WHERE target_document_id=p_document_id AND status='ACTIVE';
  v_out:=GREATEST(v_doc.grand_total-v_paid-v_credit,0);
  v_status:=CASE WHEN v_out=0 THEN 'PAID' WHEN v_paid+v_credit>0 THEN 'PARTIALLY_PAID'
    WHEN v_doc.due_date IS NOT NULL AND v_doc.due_date<CURRENT_DATE THEN 'OVERDUE' ELSE 'CONFIRMED' END;
  UPDATE public.documents SET amount_paid=v_paid,outstanding_amount=v_out,status=v_status,updated_at=now() WHERE id=p_document_id;
  UPDATE public.ledger_entries SET outstanding_amount=v_out
    WHERE source_document_id=p_document_id AND status='CONFIRMED';
END;
$$;

CREATE OR REPLACE FUNCTION public.create_and_confirm_credit_note_v2(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_source_document_id UUID,
  p_document_date DATE,
  p_reason TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_return_stock BOOLEAN DEFAULT false,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,audit,pg_temp AS $$
DECLARE
  v_company UUID:=public.get_user_company_id(); v_source public.documents; v_source_type TEXT;
  v_type public.document_types; v_doc public.documents; v_doc_id UUID:=gen_random_uuid();
  v_item JSONB; v_line public.document_lines; v_qty NUMERIC(18,3); v_used NUMERIC(18,3);
  v_ratio NUMERIC; v_net NUMERIC(18,2); v_tax NUMERIC(18,2); v_total NUMERIC(18,2);
  v_subtotal NUMERIC(18,2):=0; v_tax_total NUMERIC(18,2):=0; v_grand NUMERIC(18,2):=0;
  v_line_no INT:=0; v_number BIGINT; v_prefix TEXT; v_display TEXT; v_existing public.documents;
BEGIN
  PERFORM public.require_operational_mode();
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF COALESCE(p_entity_type,'') NOT IN('CUSTOMER','SUPPLIER') OR p_entity_id IS NULL OR p_source_document_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CREDIT_NOTE_PARTY_OR_SOURCE'; END IF;
  IF NOT (public.has_permission('financial_adjustments.create') AND public.has_permission('financial_adjustments.confirm'))
     AND NOT (p_entity_type='CUSTOMER' AND public.has_permission('sales.credit_note.create') AND public.has_permission('sales.credit_note.confirm'))
     AND NOT (p_entity_type='SUPPLIER' AND public.has_permission('purchases.credit_advice.create') AND public.has_permission('purchases.credit_advice.confirm'))
     AND NOT public.has_permission('settings.manage') THEN RAISE EXCEPTION 'PERMISSION_DENIED: credit note'; END IF;
  IF NULLIF(TRIM(COALESCE(p_idempotency_key,'')),'') IS NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED'; END IF;
  SELECT * INTO v_existing FROM public.documents WHERE company_id=v_company AND idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_source FROM public.documents WHERE id=p_source_document_id AND company_id=v_company FOR UPDATE;
  IF NOT FOUND OR v_source.status IN('DRAFT','CANCELLED','REVERSED') THEN RAISE EXCEPTION 'INVALID_SOURCE_DOCUMENT'; END IF;
  SELECT code INTO v_source_type FROM public.document_types WHERE id=v_source.document_type_id;
  IF p_entity_type='CUSTOMER' THEN
    IF v_source.customer_id<>p_entity_id OR v_source_type NOT IN('CUSTOMER_INVOICE','CASH_SALE') THEN RAISE EXCEPTION 'INVALID_CUSTOMER_SOURCE_DOCUMENT'; END IF;
    SELECT * INTO v_type FROM public.document_types WHERE company_id=v_company AND code='CUSTOMER_CREDIT_NOTE'; v_prefix:='NC';
  ELSE
    IF v_source.supplier_id<>p_entity_id OR v_source_type<>'SUPPLIER_INVOICE' THEN RAISE EXCEPTION 'INVALID_SUPPLIER_SOURCE_DOCUMENT'; END IF;
    SELECT * INTO v_type FROM public.document_types WHERE company_id=v_company AND code='SUPPLIER_CREDIT_ADVICE'; v_prefix:='NCF';
  END IF;
  IF v_type.id IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'CREDIT_NOTE_REQUIRES_SOURCE_LINES'; END IF;

  INSERT INTO public.documents(company_id,branch_id,warehouse_id,document_type_id,fiscal_period_id,series,document_date,due_date,
    customer_id,supplier_id,payment_term_id,source_document_id,salesperson_name,status,notes,idempotency_key,created_by,updated_by)
  VALUES(v_company,v_source.branch_id,v_source.warehouse_id,v_type.id,v_source.fiscal_period_id,v_source.series,
    COALESCE(p_document_date,CURRENT_DATE),COALESCE(p_document_date,CURRENT_DATE),
    CASE WHEN p_entity_type='CUSTOMER' THEN p_entity_id END,CASE WHEN p_entity_type='SUPPLIER' THEN p_entity_id END,
    v_source.payment_term_id,v_source.id,v_source.salesperson_name,'DRAFT',TRIM(CONCAT(COALESCE(p_reason,''),' ',COALESCE(p_notes,''))),
    p_idempotency_key,auth.uid(),auth.uid()) RETURNING * INTO v_doc;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_line FROM public.document_lines WHERE id=(v_item->>'source_line_id')::UUID AND document_id=v_source.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SOURCE_LINE'; END IF;
    v_qty:=ROUND(COALESCE((v_item->>'quantity')::NUMERIC,0),3);
    SELECT COALESCE(SUM(dl.quantity),0) INTO v_used FROM public.document_lines dl JOIN public.documents d ON d.id=dl.document_id
      JOIN public.document_types dt ON dt.id=d.document_type_id
      WHERE dl.source_document_line_id=v_line.id AND d.status NOT IN('CANCELLED','REVERSED')
        AND dt.code IN('CUSTOMER_CREDIT_NOTE','SUPPLIER_CREDIT_ADVICE');
    IF v_qty<=0 OR v_qty>v_line.quantity-v_used THEN RAISE EXCEPTION 'CREDIT_QUANTITY_EXCEEDS_AVAILABLE_LINE: %',v_line.description_snapshot; END IF;
    v_ratio:=v_qty/v_line.quantity; v_net:=ROUND(v_line.net_amount*v_ratio,2); v_tax:=ROUND(v_line.tax_amount*v_ratio,2); v_total:=v_net+v_tax;
    v_line_no:=v_line_no+1; v_subtotal:=v_subtotal+v_net; v_tax_total:=v_tax_total+v_tax; v_grand:=v_grand+v_total;
    INSERT INTO public.document_lines(company_id,document_id,line_number,product_id,product_code_snapshot,description_snapshot,
      unit_code_snapshot,quantity,unit_price,discount_percentage,discount_amount,tax_code_id,tax_code_snapshot,tax_rate_snapshot,
      net_amount,tax_amount,total_amount,unit_cost_snapshot,stock_effect_enabled,source_document_line_id)
    VALUES(v_company,v_doc.id,v_line_no,v_line.product_id,v_line.product_code_snapshot,v_line.description_snapshot,v_line.unit_code_snapshot,
      v_qty,v_line.unit_price,v_line.discount_percentage,ROUND(v_line.discount_amount*v_ratio,2),v_line.tax_code_id,v_line.tax_code_snapshot,
      v_line.tax_rate_snapshot,v_net,v_tax,v_total,v_line.unit_cost_snapshot,p_return_stock AND v_line.product_id IS NOT NULL,v_line.id);
  END LOOP;
  IF v_grand<=0 THEN RAISE EXCEPTION 'INVALID_CREDIT_NOTE_TOTAL'; END IF;

  v_number:=private.next_document_number(v_company,v_type.id,v_source.fiscal_period_id,v_source.series);
  v_display:=v_prefix||'-'||TO_CHAR(COALESCE(p_document_date,CURRENT_DATE),'YYYY')||'/'||LPAD(v_number::TEXT,6,'0');
  UPDATE public.documents SET document_number=v_number,display_number=v_display,status='CONFIRMED',subtotal=v_subtotal,net_total=v_subtotal,
    tax_total=v_tax_total,grand_total=v_grand,amount_paid=0,outstanding_amount=0,financial_posted=true,
    stock_posted=EXISTS(SELECT 1 FROM public.document_lines dl WHERE dl.document_id=v_doc.id AND dl.stock_effect_enabled AND dl.product_id IS NOT NULL),
    confirmed_by=auth.uid(),confirmed_at=now(),updated_at=now() WHERE id=v_doc.id RETURNING * INTO v_doc;

  INSERT INTO public.ledger_entries(company_id,branch_id,party_type,customer_id,supplier_id,entry_date,due_date,entry_type,
    debit_amount,credit_amount,outstanding_amount,source_document_id,status,created_by)
  VALUES(v_company,v_doc.branch_id,p_entity_type,CASE WHEN p_entity_type='CUSTOMER' THEN p_entity_id END,
    CASE WHEN p_entity_type='SUPPLIER' THEN p_entity_id END,v_doc.document_date,v_doc.due_date,v_type.code,
    CASE WHEN p_entity_type='SUPPLIER' THEN v_grand ELSE 0 END,CASE WHEN p_entity_type='CUSTOMER' THEN v_grand ELSE 0 END,
    0,v_doc.id,'CONFIRMED',auth.uid());

  INSERT INTO public.financial_advice_allocations(company_id,advice_document_id,target_document_id,allocated_amount,created_by)
    VALUES(v_company,v_doc.id,v_source.id,v_grand,auth.uid());
  INSERT INTO public.document_links(company_id,source_document_id,target_document_id,link_type,created_by)
    VALUES(v_company,v_source.id,v_doc.id,CASE WHEN p_entity_type='CUSTOMER' THEN 'INVOICE_TO_CREDIT_NOTE' ELSE 'SUPPLIER_INVOICE_TO_CREDIT' END,auth.uid());

  IF p_return_stock THEN
    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id=v_doc.id AND stock_effect_enabled AND product_id IS NOT NULL LOOP
      PERFORM public.post_stock_movement(p_company_id:=v_company,p_product_id:=v_line.product_id,p_warehouse_id:=v_doc.warehouse_id,
        p_movement_type:=CASE WHEN p_entity_type='CUSTOMER' THEN 'customer_return' ELSE 'supplier_return' END,
        p_quantity_in:=CASE WHEN p_entity_type='CUSTOMER' THEN v_line.quantity ELSE 0 END,
        p_quantity_out:=CASE WHEN p_entity_type='SUPPLIER' THEN v_line.quantity ELSE 0 END,
        p_unit_cost:=COALESCE(v_line.unit_cost_snapshot,0),p_source_document_id:=v_doc.id,p_source_document_line_id:=v_line.id,
        p_customer_id:=CASE WHEN p_entity_type='CUSTOMER' THEN p_entity_id END,p_supplier_id:=CASE WHEN p_entity_type='SUPPLIER' THEN p_entity_id END);
    END LOOP;
  END IF;
  PERFORM private.refresh_document_payment_status(v_source.id);
  IF p_entity_type='CUSTOMER' THEN PERFORM private.refresh_customer_balance(p_entity_id); ELSE PERFORM private.refresh_supplier_balance(p_entity_id); END IF;
  INSERT INTO public.document_status_history(company_id,document_id,previous_status,new_status,reason,changed_by)
    VALUES(v_company,v_doc.id,'DRAFT','CONFIRMED','Nota de crédito ligada a '||v_source.display_number,auth.uid());
  RETURN v_doc;
END;
$$;

REVOKE ALL ON FUNCTION public.create_and_confirm_credit_note_v2(TEXT,UUID,UUID,DATE,TEXT,TEXT,JSONB,BOOLEAN,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_and_confirm_credit_note_v2(TEXT,UUID,UUID,DATE,TEXT,TEXT,JSONB,BOOLEAN,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_credit_note_v2(p_document_id UUID,p_reason TEXT,p_idempotency_key UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_doc public.documents; v_type TEXT; v_line RECORD;
BEGIN
  IF auth.uid() IS NULL OR (NOT public.has_permission('financial_adjustments.cancel') AND NOT public.has_permission('settings.manage')) THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  IF NULLIF(TRIM(COALESCE(p_reason,'')),'') IS NULL OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'REASON_AND_IDEMPOTENCY_REQUIRED'; END IF;
  SELECT d.* INTO v_doc FROM public.documents d WHERE d.id=p_document_id AND d.company_id=public.get_user_company_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
  SELECT code INTO v_type FROM public.document_types WHERE id=v_doc.document_type_id;
  IF v_type NOT IN('CUSTOMER_CREDIT_NOTE','SUPPLIER_CREDIT_ADVICE') THEN RAISE EXCEPTION 'INVALID_CREDIT_NOTE'; END IF;
  IF v_doc.status='CANCELLED' THEN RETURN true; END IF;
  IF v_doc.status<>'CONFIRMED' THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  IF v_doc.stock_posted THEN
    FOR v_line IN SELECT * FROM public.document_lines WHERE document_id=v_doc.id AND stock_effect_enabled AND product_id IS NOT NULL LOOP
      PERFORM public.post_stock_movement(p_company_id:=v_doc.company_id,p_product_id:=v_line.product_id,p_warehouse_id:=v_doc.warehouse_id,
        p_movement_type:='credit_note_reversal',p_quantity_in:=CASE WHEN v_doc.supplier_id IS NOT NULL THEN v_line.quantity ELSE 0 END,
        p_quantity_out:=CASE WHEN v_doc.customer_id IS NOT NULL THEN v_line.quantity ELSE 0 END,p_unit_cost:=COALESCE(v_line.unit_cost_snapshot,0),
        p_source_document_id:=v_doc.id,p_source_document_line_id:=v_line.id,p_customer_id:=v_doc.customer_id,p_supplier_id:=v_doc.supplier_id);
    END LOOP;
  END IF;
  UPDATE public.ledger_entries SET status='REVERSED' WHERE source_document_id=v_doc.id AND status='CONFIRMED';
  UPDATE public.financial_advice_allocations SET status='REVERSED',reversed_at=now(),reversed_by=auth.uid()
    WHERE advice_document_id=v_doc.id AND status='ACTIVE';
  UPDATE public.documents SET status='CANCELLED',cancelled_by=auth.uid(),cancelled_at=now(),cancellation_reason=TRIM(p_reason),updated_at=now() WHERE id=v_doc.id;
  IF v_doc.source_document_id IS NOT NULL THEN PERFORM private.refresh_document_payment_status(v_doc.source_document_id); END IF;
  IF v_doc.customer_id IS NOT NULL THEN PERFORM private.refresh_customer_balance(v_doc.customer_id); ELSE PERFORM private.refresh_supplier_balance(v_doc.supplier_id); END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_credit_note_v2(UUID,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_credit_note_v2(UUID,TEXT,UUID) TO authenticated;

-- A walk-in invoice may not create anonymous credit. Immediate invoices are settled at confirmation.
CREATE OR REPLACE FUNCTION private.apply_immediate_customer_invoice_policy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_type TEXT; v_walk_in BOOLEAN; v_immediate BOOLEAN;
BEGIN
  IF OLD.status='DRAFT' AND NEW.status='CONFIRMED' THEN
    SELECT code INTO v_type FROM public.document_types WHERE id=NEW.document_type_id;
    IF v_type='CUSTOMER_INVOICE' THEN
      SELECT customer_number='1' INTO v_walk_in FROM public.customers WHERE id=NEW.customer_id;
      SELECT COALESCE(requires_immediate_payment,false) INTO v_immediate FROM public.payment_terms WHERE id=NEW.payment_term_id;
      IF v_walk_in AND NOT v_immediate THEN RAISE EXCEPTION 'WALK_IN_CUSTOMER_CANNOT_BUY_ON_CREDIT: use VD or identify the customer'; END IF;
      IF v_immediate THEN
        NEW.amount_paid:=NEW.grand_total; NEW.outstanding_amount:=0; NEW.status:='PAID';
        UPDATE public.ledger_entries SET credit_amount=NEW.grand_total,outstanding_amount=0 WHERE source_document_id=NEW.id AND status='CONFIRMED';
        PERFORM private.refresh_customer_balance(NEW.customer_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_immediate_customer_invoice_policy ON public.documents;
CREATE TRIGGER trg_apply_immediate_customer_invoice_policy BEFORE UPDATE OF status ON public.documents
FOR EACH ROW EXECUTE FUNCTION private.apply_immediate_customer_invoice_policy();

-- Repair the small set of operationally posted ledgers without manufacturing ledgers for imported history.
UPDATE public.ledger_entries le SET customer_id=d.customer_id,
  debit_amount=CASE WHEN dt.code IN('CUSTOMER_INVOICE','CASH_SALE','CUSTOMER_DEBIT_NOTE') THEN d.grand_total ELSE 0 END,
  credit_amount=CASE WHEN dt.code IN('CASH_SALE','CUSTOMER_CREDIT_NOTE') THEN d.grand_total ELSE 0 END,
  outstanding_amount=d.outstanding_amount
FROM public.documents d JOIN public.document_types dt ON dt.id=d.document_type_id
WHERE le.source_document_id=d.id AND le.party_type='CUSTOMER' AND le.status='CONFIRMED' AND d.financial_posted;

-- Repair the one confirmed operational invoice whose header had been edited before line editing was transactional.
UPDATE public.document_lines dl SET
  unit_price=ROUND(d.grand_total/(1+dl.tax_rate_snapshot/100)/dl.quantity,4),
  net_amount=ROUND(d.grand_total/(1+dl.tax_rate_snapshot/100),2),
  tax_amount=d.grand_total-ROUND(d.grand_total/(1+dl.tax_rate_snapshot/100),2),
  total_amount=d.grand_total,
  discount_percentage=0,discount_amount=0,updated_at=now()
FROM public.documents d JOIN public.document_types dt ON dt.id=d.document_type_id
WHERE dl.document_id=d.id AND d.display_number='CUSTOMER_INVOICE A/000002'
  AND dt.code='CUSTOMER_INVOICE' AND d.migration_batch_id IS NULL
  AND (SELECT count(*) FROM public.document_lines only_line WHERE only_line.document_id=d.id)=1
  AND ABS(dl.total_amount-d.grand_total)>0.01;

UPDATE public.documents d SET
  subtotal=ROUND(d.grand_total/(1+COALESCE((SELECT tax_rate_snapshot FROM public.document_lines WHERE document_id=d.id LIMIT 1),0)/100),2),
  net_total=ROUND(d.grand_total/(1+COALESCE((SELECT tax_rate_snapshot FROM public.document_lines WHERE document_id=d.id LIMIT 1),0)/100),2),
  tax_total=d.grand_total-ROUND(d.grand_total/(1+COALESCE((SELECT tax_rate_snapshot FROM public.document_lines WHERE document_id=d.id LIMIT 1),0)/100),2),
  discount_total=0,general_discount_amount=0,updated_at=now()
FROM public.document_types dt
WHERE d.document_type_id=dt.id AND d.display_number='CUSTOMER_INVOICE A/000002'
  AND dt.code='CUSTOMER_INVOICE' AND d.migration_batch_id IS NULL
  AND (SELECT count(*) FROM public.document_lines dl WHERE dl.document_id=d.id)=1;

DO $$ DECLARE v_id UUID;
BEGIN
  FOR v_id IN SELECT DISTINCT customer_id FROM public.ledger_entries WHERE customer_id IS NOT NULL LOOP PERFORM private.refresh_customer_balance(v_id); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_company_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT(public.has_permission('dashboard.read') OR public.has_permission('products.view')) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: dashboard.read'; END IF;
  v_company_id:=public.get_user_company_id();
  RETURN jsonb_build_object(
    'active_products',(SELECT count(*) FROM public.products p WHERE p.company_id=v_company_id AND p.is_active),
    'low_stock_products',(SELECT count(*) FROM public.products p WHERE p.company_id=v_company_id AND p.is_active AND COALESCE((
      SELECT sum(ib.quantity) FROM public.inventory_balances ib WHERE ib.product_id=p.id AND(public.has_warehouse_access(ib.warehouse_id)
      OR NOT EXISTS(SELECT 1 FROM public.warehouse_access wa WHERE wa.user_id=auth.uid()))),0)<=p.min_stock),
    'out_of_stock_products',(SELECT count(*) FROM public.products p WHERE p.company_id=v_company_id AND p.is_active
      AND COALESCE((SELECT sum(ib.quantity) FROM public.inventory_balances ib WHERE ib.product_id=p.id),0)=0),
    'sales_today',(SELECT COALESCE(sum(d.grand_total),0) FROM public.documents d JOIN public.document_types dt ON dt.id=d.document_type_id
      WHERE d.company_id=v_company_id AND d.document_date=CURRENT_DATE AND dt.code IN('CUSTOMER_INVOICE','CASH_SALE')
      AND d.status NOT IN('DRAFT','CANCELLED','REVERSED') AND(public.has_branch_access(d.branch_id)
      OR NOT EXISTS(SELECT 1 FROM public.branch_access ba WHERE ba.user_id=auth.uid()))),
    'receivables',(SELECT COALESCE(sum(c.current_balance),0) FROM public.customers c WHERE c.company_id=v_company_id AND c.active AND c.current_balance>0),
    'debtor_count',(SELECT count(*) FROM public.customers c WHERE c.company_id=v_company_id AND c.active AND c.current_balance>0),
    'payables',(SELECT COALESCE(sum(s.current_balance),0) FROM public.suppliers s WHERE s.company_id=v_company_id AND s.active AND s.current_balance>0),
    'draft_documents',(SELECT count(*) FROM public.documents d WHERE d.company_id=v_company_id AND d.status='DRAFT'),
    'server_date',CURRENT_DATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_operational_documents_page_v2(p_limit INT DEFAULT 1000,p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH selected AS (
    SELECT d.* FROM public.documents d
    WHERE d.company_id=public.get_user_company_id() AND public.has_permission('documents.view')
    ORDER BY d.created_at DESC,d.id DESC LIMIT LEAST(GREATEST(COALESCE(p_limit,1000),1),2000) OFFSET GREATEST(COALESCE(p_offset,0),0)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',d.id,'display_number',d.display_number,'document_date',d.document_date,'due_date',d.due_date,'created_at',d.created_at,
    'source_document_id',d.source_document_id,'status',d.status,'notes',d.notes,'subtotal',d.subtotal,'discount_total',d.discount_total,
    'general_discount_amount',d.general_discount_amount,'net_total',d.net_total,'tax_total',d.tax_total,'grand_total',d.grand_total,
    'amount_paid',d.amount_paid,'outstanding_amount',d.outstanding_amount,'salesperson_name',d.salesperson_name,'customer_id',d.customer_id,
    'supplier_id',d.supplier_id,
    'customers',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('customer_number',c.customer_number,'name',c.name,'tax_number',c.tax_number) END,
    'suppliers',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('supplier_number',s.supplier_number,'name',s.name,'tax_number',s.tax_number) END,
    'payment_terms',CASE WHEN pt.id IS NULL THEN NULL ELSE jsonb_build_object('code',pt.code,'name',pt.name) END,
    'document_types',jsonb_build_object('code',dt.code,'name',dt.name),
    'document_lines',COALESCE(lines.items,'[]'::jsonb)
  ) ORDER BY d.created_at DESC,d.id DESC),'[]'::jsonb)
  FROM selected d JOIN public.document_types dt ON dt.id=d.document_type_id
  LEFT JOIN public.customers c ON c.id=d.customer_id LEFT JOIN public.suppliers s ON s.id=d.supplier_id
  LEFT JOIN public.payment_terms pt ON pt.id=d.payment_term_id
  LEFT JOIN LATERAL(
    SELECT jsonb_agg(jsonb_build_object('id',dl.id,'product_id',dl.product_id,'product_code_snapshot',dl.product_code_snapshot,
      'description_snapshot',dl.description_snapshot,'quantity',dl.quantity,'unit_price',dl.unit_price,'discount_percentage',dl.discount_percentage,
      'discount_amount',dl.discount_amount,'tax_rate_snapshot',dl.tax_rate_snapshot,'total_amount',dl.total_amount,
      'stock_effect_enabled',dl.stock_effect_enabled) ORDER BY dl.line_number) items
    FROM public.document_lines dl WHERE dl.document_id=d.id
  )lines ON true;
$$;
REVOKE ALL ON FUNCTION public.get_operational_documents_page_v2(INT,INT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_operational_documents_page_v2(INT,INT) TO authenticated;

-- Preserve supplier opening balances as auditable opening entries when no supplier ledger exists yet.
INSERT INTO public.ledger_entries(company_id,branch_id,party_type,supplier_id,entry_date,entry_type,debit_amount,credit_amount,outstanding_amount,status,created_by)
SELECT s.company_id,b.id,'SUPPLIER',s.id,CURRENT_DATE,'OPENING_BALANCE',0,s.current_balance,s.current_balance,'CONFIRMED',u.id
FROM public.suppliers s
JOIN LATERAL(SELECT id FROM public.branches WHERE company_id=s.company_id ORDER BY created_at LIMIT 1)b ON true
JOIN LATERAL(SELECT id FROM public.user_profiles WHERE company_id=s.company_id AND is_active ORDER BY created_at LIMIT 1)u ON true
WHERE s.current_balance<>0 AND NOT EXISTS(SELECT 1 FROM public.ledger_entries le WHERE le.supplier_id=s.id AND le.status='CONFIRMED');

INSERT INTO public.document_types(company_id,code,name,direction,party_type,affects_stock,stock_direction,
  affects_customer_account,affects_supplier_account,requires_customer,requires_supplier,requires_source_document,active)
SELECT c.id,'SUPPLIER_OPENING_BALANCE','Saldo de Abertura de Fornecedor','SUPPLIER','SUPPLIER',false,'NONE',false,true,false,true,false,true
FROM public.companies c ON CONFLICT(company_id,code) DO UPDATE SET name=EXCLUDED.name,active=true;

DO $$
DECLARE v_entry public.ledger_entries; v_type UUID; v_period UUID; v_warehouse UUID; v_doc UUID; v_number BIGINT;
BEGIN
  FOR v_entry IN SELECT le.* FROM public.ledger_entries le
    WHERE le.party_type='SUPPLIER' AND le.entry_type='OPENING_BALANCE' AND le.status='CONFIRMED' AND le.source_document_id IS NULL
  LOOP
    SELECT id INTO v_type FROM public.document_types WHERE company_id=v_entry.company_id AND code='SUPPLIER_OPENING_BALANCE';
    SELECT id INTO v_period FROM public.fiscal_periods WHERE company_id=v_entry.company_id AND v_entry.entry_date BETWEEN start_date AND end_date ORDER BY start_date DESC LIMIT 1;
    IF v_period IS NULL THEN SELECT id INTO v_period FROM public.fiscal_periods WHERE company_id=v_entry.company_id ORDER BY start_date DESC LIMIT 1; END IF;
    SELECT id INTO v_warehouse FROM public.warehouses WHERE company_id=v_entry.company_id ORDER BY created_at LIMIT 1;
    IF v_period IS NULL THEN RAISE EXCEPTION 'FISCAL_PERIOD_REQUIRED_FOR_SUPPLIER_OPENING_BALANCE'; END IF;
    v_number:=private.next_document_number(v_entry.company_id,v_type,v_period,'A');
    INSERT INTO public.documents(company_id,branch_id,warehouse_id,document_type_id,fiscal_period_id,series,document_number,display_number,
      document_date,due_date,supplier_id,status,subtotal,net_total,tax_total,grand_total,amount_paid,outstanding_amount,
      financial_posted,stock_posted,notes,idempotency_key,created_by,updated_by,confirmed_by,confirmed_at)
    VALUES(v_entry.company_id,v_entry.branch_id,v_warehouse,v_type,v_period,'A',v_number,
      'SAF-'||TO_CHAR(v_entry.entry_date,'YYYY')||'/'||LPAD(v_number::TEXT,6,'0'),v_entry.entry_date,v_entry.entry_date,
      v_entry.supplier_id,'CONFIRMED',v_entry.credit_amount,v_entry.credit_amount,0,v_entry.credit_amount,0,v_entry.credit_amount,
      true,false,'Saldo inicial preservado e convertido em documento pagável','supplier-opening-balance-'||v_entry.supplier_id,
      v_entry.created_by,v_entry.created_by,v_entry.created_by,COALESCE(v_entry.created_at,now())) RETURNING id INTO v_doc;
    INSERT INTO public.document_lines(company_id,document_id,line_number,description_snapshot,unit_code_snapshot,quantity,unit_price,
      discount_percentage,discount_amount,tax_rate_snapshot,net_amount,tax_amount,total_amount,stock_effect_enabled)
    VALUES(v_entry.company_id,v_doc,1,'Saldo de abertura do fornecedor','UN',1,v_entry.credit_amount,0,0,0,
      v_entry.credit_amount,0,v_entry.credit_amount,false);
    UPDATE public.ledger_entries SET source_document_id=v_doc WHERE id=v_entry.id;
  END LOOP;
END $$;

COMMIT;
