-- Constraints for Casa de Pneus (PostgreSQL)

-- Catalogue
ALTER TABLE tax_codes ADD CONSTRAINT chk_tax_rate_range CHECK (rate >= 0 AND rate <= 100);
ALTER TABLE products ADD CONSTRAINT chk_sale_prices_positive CHECK (sale_price_excl >= 0 AND sale_price_incl >= 0);
ALTER TABLE products ADD CONSTRAINT chk_avg_cost_positive CHECK (avg_cost >= 0);

-- Documents
ALTER TABLE documents ADD CONSTRAINT chk_doc_totals_positive CHECK (
    subtotal >= 0 AND tax_total >= 0 AND grand_total >= 0
);
ALTER TABLE document_lines ADD CONSTRAINT chk_doc_line_qty_positive CHECK (quantity > 0);
ALTER TABLE document_lines ADD CONSTRAINT chk_doc_line_values_positive CHECK (
    unit_price >= 0 AND net_value >= 0 AND tax_value >= 0 AND total_value >= 0
);

-- Stock
ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_qty_positive CHECK (
    quantity_in >= 0 AND quantity_out >= 0 AND (quantity_in > 0 OR quantity_out > 0)
);
ALTER TABLE inventory_balances ADD CONSTRAINT chk_inventory_qty_non_negative CHECK (quantity >= 0);

-- Document Workflow Immutability (Example Trigger)
CREATE OR REPLACE FUNCTION check_document_immutability() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'confirmed' AND NEW.status != 'cancelled' THEN
        IF OLD.grand_total != NEW.grand_total OR OLD.subtotal != NEW.subtotal THEN
            RAISE EXCEPTION 'Cannot modify financial totals of a confirmed document.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_doc_immutability
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION check_document_immutability();
