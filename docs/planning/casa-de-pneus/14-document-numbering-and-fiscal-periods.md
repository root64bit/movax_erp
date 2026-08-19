# Document Numbering and Fiscal Periods

## 1. Overview
In the Casa de Pneus management system, strict adherence to document numbering and fiscal period management is required to comply with Mozambique fiscal regulations and internal accounting standards. Documents must be sequentially numbered without gaps, and organized by fiscal periods (years/months).

## 2. Fiscal Period Management
- **Yearly Periods**: Each fiscal year must be defined (e.g., 2024, 2025). The transition from one year to the next resets document sequences for types that require it.
- **Monthly Close**: The system should allow closing periods on a monthly basis. Once a month is closed, no new financial documents (invoices, receipts, stock movements) can be created or modified for that month.
- **Closing Mechanism**: A `fiscal_periods` table tracks the status (`open`, `closed`) of each period. A check at the database level (e.g., via trigger) ensures no inserts/updates occur on documents dated in a `closed` period.
- **Year Transition Handling**: During the transition to a new fiscal year, new series or sequences are generated. Opening balances for stock and current accounts can be rolled over or recreated.

## 3. Document Numbering Rules
Document numbering must be unique across the combination of:
- `company_id`
- `document_type_id`
- `series_id`
- `fiscal_period_id`

### 3.1 Gap-Free Sequential Numbering
Mozambican tax law requires gap-free sequential numbering for invoices and related fiscal documents. 
- To guarantee this, document sequences will be managed through a dedicated `document_sequences` table.
- **Atomic Increment**: The sequence generation will use a `SELECT ... FOR UPDATE` or PostgreSQL advisory locks within a transaction to ensure that concurrent document creations do not result in duplicate numbers or gaps. If a transaction fails, the number generation is rolled back, preventing gaps.

### 3.2 Series Management
- By default, documents will use series `A`.
- Additional series (e.g., `B`, `C`) can be created for specific branches, terminals, or manual transition purposes.
- Each series maintains its own counter per document type and fiscal period.

### 3.3 Number Format
The standard format is: `TYPE SERIES/NUMBER`
- Example: `FT A/00001` (Factura, Series A, Number 1)
- `NC A/00023` (Nota de Crédito)
- The numerical part is typically zero-padded (e.g., to 5 or 6 digits) for readability and sorting.

## 4. Implementation Specifications

### `document_sequences` Table Structure
```sql
CREATE TABLE document_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    document_type VARCHAR(10) NOT NULL, -- e.g., 'FT', 'VD'
    series VARCHAR(10) NOT NULL DEFAULT 'A',
    fiscal_year INT NOT NULL,
    current_value INT NOT NULL DEFAULT 0,
    UNIQUE (company_id, document_type, series, fiscal_year)
);
```

### Sequence Generation Logic
```sql
-- Conceptual function for sequence generation
CREATE OR REPLACE FUNCTION get_next_document_number(
    p_company_id UUID, 
    p_doc_type VARCHAR, 
    p_series VARCHAR, 
    p_year INT
) RETURNS INT AS $$
DECLARE
    next_val INT;
BEGIN
    UPDATE document_sequences
    SET current_value = current_value + 1
    WHERE company_id = p_company_id
      AND document_type = p_doc_type
      AND series = p_series
      AND fiscal_year = p_year
    RETURNING current_value INTO next_val;
    
    -- If no row exists, insert one (handle appropriately to avoid race conditions)
    -- ...
    
    RETURN next_val;
END;
$$ LANGUAGE plpgsql;
```

## 5. Mozambique Fiscal Compliance Considerations
- **Immutability**: Once an invoice is confirmed and a number is assigned, it cannot be deleted. Any corrections must be made via a Credit Note (Nota de Crédito).
- **SAF-T (PT/MZ)**: While full SAF-T export might be scheduled for a later phase, the foundational requirement of gap-free, series-based numbering ensures the data structure is ready for compliance.
- **Voiding**: If a document needs to be canceled immediately after creation (Anulado), its number is still consumed and marked as canceled. It is not physically deleted from the database.
