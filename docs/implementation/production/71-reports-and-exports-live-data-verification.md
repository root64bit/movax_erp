# Reports and exports live-data verification

Migration 019 adds `get_operational_report` for sales, VAT, stock, receivables, and payables. It validates report permissions and applies company, branch, warehouse, date, limit, and offset controls. UI pages use 50 rows; CSV requests the filtered server result (up to the protected 1,000-row cap) and writes UTF-8 with Portuguese headers.
