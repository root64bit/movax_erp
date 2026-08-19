# Testing Strategy

## 1. Overview
To ensure the Casa de Pneus management system is reliable, financially accurate, and secure, a comprehensive testing strategy is required. Testing will span from individual function logic to full system end-to-end workflows.

## 2. Testing Matrix

### 2.1 Unit Tests
*Focus: Isolated business logic and utility functions.*
*Tools: Jest / Vitest*
- **Price Calculations**: Gross to net, net to gross rounding.
- **VAT Calculation**: Ensure strict 16% Mozambique VAT calculations with correct decimal rounding (half up).
- **Discounts**: Line-level vs document-level discount application.
- **Payment Allocation**: Logic for distributing partial payments across multiple open invoices.
- **Credit Limit Checks**: Calculating if a new invoice exceeds a customer's `credit_limit`.
- **Stock Availability**: Logic for determining if an item can be sold based on current quantity.

### 2.2 Database Tests
*Focus: Schema integrity, triggers, and RLS at the PostgreSQL level.*
*Tools: pgTAP (Supabase testing integration)*
- **Constraints**: Ensure negative quantities or prices are rejected where applicable.
- **Triggers**: Verify `updated_at` timestamps update correctly.
- **Document Sequences**: Test gap-free sequential numbering (concurrent insertion tests).
- **Stock Posting**: Verify stock balance updates when an invoice/delivery note is confirmed.
- **Payment Posting**: Verify current account balance updates when a receipt is issued.
- **Reversals**: Test the impact of document cancellation on stock and ledgers.
- **Cross-Company Isolation**: Ensure operations in one `company_id` do not affect another.

### 2.3 Integration Tests
*Focus: API endpoints and cross-module workflows.*
*Tools: Supertest / API testing via Vitest*
- **Draft → Confirmed**: Lifecycle of a document.
- **Invoice → Stock Exit**: Confirming an invoice correctly reduces stock.
- **Purchase → Stock Entry**: Registering a supplier invoice increases stock.
- **Credit Note → Return**: Issuing a credit note restores stock and adjusts balances.
- **Payment → Ledger**: Customer payment updates the outstanding balance correctly.
- **Partial Payment**: Verifying correct outstanding amounts after partial payments.
- **Multi-Doc Payment**: Applying one large payment to multiple invoices.
- **Payment Reversal**: Canceling a payment and restoring invoice debts.

### 2.4 Permission Tests
*Focus: Security and Row Level Security (RLS).*
- **Role matrix**: Test every role (Admin, Manager, Operator) against protected actions (delete document, change price, view cost).
- **Cost Masking**: Ensure Operators cannot access `cost_price` via API or RPC calls.
- **Branch/Warehouse Isolation**: If applicable, ensure users only see data for their assigned branch.

### 2.5 Migration Tests
*Focus: Accuracy of the legacy data import.*
- **Row Counts**: Verify exact counts between old and new systems.
- **Totals**: Compare sum of balances and stock value.
- **Referential Integrity**: Ensure no orphaned lines or payments.
- **Encoding & Dates**: Verify special characters and timestamp conversions.

### 2.6 End-to-End (E2E) Tests
*Focus: User workflows in the browser.*
*Tools: Playwright / Cypress*
- Create a new article.
- Receive stock from a supplier.
- Create a sale (Customer Invoice).
- Receive payment (Customer Receipt).
- Print receipt (verify layout triggers).
- Process a return (Credit Note).
- Register a supplier invoice.
- Pay the supplier.
- Generate and verify reports (Sales, Stock).

## 3. Test Data Strategy
- **Fixtures**: Maintain static JSON fixtures for mock data (articles, customers).
- **Factory Functions**: Use libraries to generate random but valid test data (e.g., faker.js).
- **Isolated DB**: All tests must run against a dedicated test database that is reset before each suite.

## 4. CI/CD Integration
- All unit, database, integration, and permission tests must run automatically on every Pull Request via GitHub Actions.
- E2E tests run on major branches (main, staging) or nightly.
- PRs cannot be merged unless test coverage meets the defined threshold (e.g., 80%) and all tests pass.
