# Reconciliation Plan

## 1. Overview
Reconciliation ensures that the data migrated from XT-POS PRO v3.50 to the new Casa de Pneus system is complete, accurate, and financially sound. This phase occurs after the data transformation and before final cutover.

## 2. Reconciliation Checks by Entity

### 2.1 Articles (Stock)
- **Count Comparison**: Total number of articles in legacy vs. target.
- **Status Check**: Count of `Active` vs `Inactive` articles.
- **Total Stock Value**: Sum of `(Stock Quantity * Cost Price)` in legacy vs. target.

### 2.2 Customers
- **Count Comparison**: Total number of customers.
- **Balance per Customer**: Legacy current account balance vs. new system balance (or opening balance).
- **Total Receivables**: Sum of all outstanding customer balances.

### 2.3 Suppliers
- **Count Comparison**: Total number of suppliers.
- **Balance per Supplier**: Legacy account balance vs. new system balance.
- **Total Payables**: Sum of all outstanding supplier balances.

### 2.4 Documents
- **Count per Type**: Number of Invoices, Receipts, Credit Notes, etc., legacy vs. target.
- **Total per Type**: Sum of total amounts for each document type.
- **Line Count**: Total number of document lines migrated.

### 2.5 Stock Movements
- **Quantity per Article**: Aggregate of all movements per article must match the final stock quantity in both systems.

### 2.6 Payments
- **Count Comparison**: Total number of payment receipts.
- **Total per Method**: Sum of cash, bank transfers, POS, and checks.

### 2.7 VAT
- **Total Collected**: Sum of VAT on sales documents.
- **Total Paid**: Sum of VAT on purchase documents.

## 3. Variance Tolerance Thresholds
- **Financial Totals (Balances, Invoices)**: `0.00 MZN` tolerance. Must match exactly. (Note: minor rounding errors of +/- 0.01 MZN across thousands of records may occur due to float-to-numeric conversion. These must be identified and grouped in an adjustment account if necessary).
- **Record Counts**: `0` tolerance. Every record must be accounted for (either migrated successfully or intentionally skipped/merged with an explicit log).
- **Stock Quantities**: `0` tolerance.

## 4. Reconciliation Report Format
A script should generate a PDF or Excel report summarizing the findings.
**Example Structure:**
1. **Executive Summary**: Pass/Fail status.
2. **Entity Summaries**: 
   - Entity Name | Legacy Count | Target Count | Variance
   - Totals | Legacy Total (MZN) | Target Total (MZN) | Variance
3. **Exception List**: Detailed list of legacy IDs that failed migration or have mismatched balances.

## 5. Sign-off Procedure
1. **Automated Generation**: The technical team runs the reconciliation scripts.
2. **Review**: The Casa de Pneus accounting/management team reviews the report.
3. **Adjustment**: Any required adjustments (e.g., writing off old bad debts before migration) are documented and applied via scripts.
4. **Sign-off**: Management signs a physical or digital copy of the final reconciliation report, approving the cutover.

## 6. Evidence Preservation
- The final legacy database files, the raw CSV extracts, the transformation logs, and the signed reconciliation report are archived securely (e.g., in cloud storage and a physical backup drive) for future audit purposes by the Mozambique Tax Authority or internal auditors.
