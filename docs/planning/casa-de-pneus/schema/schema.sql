-- Schema for Casa de Pneus (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Core
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tax_number VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Catalogue
CREATE TABLE tax_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    rate NUMERIC(5,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE product_families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50)
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    barcode VARCHAR(100),
    description TEXT NOT NULL,
    family_id UUID REFERENCES product_families(id),
    tax_code_id UUID REFERENCES tax_codes(id),
    min_stock NUMERIC(15,3) DEFAULT 0,
    avg_cost NUMERIC(15,2) DEFAULT 0,
    sale_price_excl NUMERIC(15,2) NOT NULL,
    sale_price_incl NUMERIC(15,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    legacy_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_number VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    postal_code VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    tax_number VARCHAR(50),
    credit_limit NUMERIC(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    legacy_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Documents
CREATE TABLE document_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    affects_stock BOOLEAN DEFAULT FALSE,
    affects_ledger BOOLEAN DEFAULT FALSE
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES document_types(id),
    series VARCHAR(50) NOT NULL,
    number INTEGER NOT NULL,
    date DATE NOT NULL,
    entity_id UUID,
    entity_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_total NUMERIC(15,2) DEFAULT 0,
    grand_total NUMERIC(15,2) DEFAULT 0,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    legacy_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    product_id UUID REFERENCES products(id),
    description_snapshot TEXT NOT NULL,
    quantity NUMERIC(15,3) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    tax_rate NUMERIC(5,2) NOT NULL,
    net_value NUMERIC(15,2) NOT NULL,
    tax_value NUMERIC(15,2) NOT NULL,
    total_value NUMERIC(15,2) NOT NULL
);

-- 5. Stock
CREATE TABLE inventory_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity NUMERIC(15,3) DEFAULT 0,
    avg_cost NUMERIC(15,2) DEFAULT 0,
    last_movement_at TIMESTAMPTZ
);

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    movement_type VARCHAR(50) NOT NULL,
    quantity_in NUMERIC(15,3) DEFAULT 0,
    quantity_out NUMERIC(15,3) DEFAULT 0,
    unit_cost NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Additional tables implied (Suppliers, Ledger, Administration, Migration omitted for brevity but strictly adhere to same patterns).
