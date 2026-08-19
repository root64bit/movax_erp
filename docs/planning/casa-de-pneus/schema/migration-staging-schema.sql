-- Migration Staging Schema (XT-POS Raw Import Tables)

CREATE TABLE legacy_products_raw (
    import_id SERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    ref_code VARCHAR(255),
    desc_prod TEXT,
    family_str VARCHAR(255),
    stock_atual VARCHAR(50),
    preco_venda VARCHAR(50),
    iva_code VARCHAR(10),
    process_status VARCHAR(20) DEFAULT 'pending',
    error_log TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE legacy_customers_raw (
    import_id SERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    cod_cliente VARCHAR(255),
    nome TEXT,
    nuit VARCHAR(50),
    morada TEXT,
    telefone VARCHAR(50),
    saldo_aberto VARCHAR(50),
    process_status VARCHAR(20) DEFAULT 'pending',
    error_log TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE legacy_documents_raw (
    import_id SERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    tipo_doc VARCHAR(50),
    serie VARCHAR(50),
    num_doc VARCHAR(50),
    data_doc VARCHAR(50),
    cod_cliente VARCHAR(255),
    total_doc VARCHAR(50),
    process_status VARCHAR(20) DEFAULT 'pending',
    error_log TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE legacy_document_lines_raw (
    import_id SERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    tipo_doc VARCHAR(50),
    serie VARCHAR(50),
    num_doc VARCHAR(50),
    num_linha VARCHAR(10),
    cod_artigo VARCHAR(255),
    qtd VARCHAR(50),
    preco_unitario VARCHAR(50),
    process_status VARCHAR(20) DEFAULT 'pending',
    error_log TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);
