-- Indexes for Casa de Pneus (PostgreSQL)

-- Core
CREATE INDEX idx_branches_company ON branches(company_id);
CREATE INDEX idx_warehouses_branch ON warehouses(branch_id);

-- Catalogue
CREATE UNIQUE INDEX idx_products_code_company ON products(company_id, code);
CREATE INDEX idx_products_family ON products(family_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_legacy_id ON products(legacy_id);

-- Customers
CREATE UNIQUE INDEX idx_customers_number_company ON customers(company_id, customer_number);
CREATE INDEX idx_customers_legacy_id ON customers(legacy_id);

-- Documents
CREATE UNIQUE INDEX idx_documents_unique_number ON documents(company_id, document_type_id, series, number);
CREATE INDEX idx_documents_date ON documents(date);
CREATE INDEX idx_documents_entity ON documents(entity_id);
CREATE INDEX idx_documents_legacy_id ON documents(legacy_id);

CREATE INDEX idx_document_lines_document ON document_lines(document_id);
CREATE INDEX idx_document_lines_product ON document_lines(product_id);

-- Stock
CREATE UNIQUE INDEX idx_inventory_balances_unique ON inventory_balances(company_id, warehouse_id, product_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);

-- Performance Composite Indexes
CREATE INDEX idx_docs_company_status_date ON documents(company_id, status, date);
