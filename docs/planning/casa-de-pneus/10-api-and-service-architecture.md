# 10 API and Service Architecture

## Overview
This document defines the complete API structure for the Casa de Pneus management system. The architecture follows a CQRS-lite approach, separating read operations (Queries) from write operations (Commands). 

## Endpoints by Domain

### /auth
- **POST /auth/login** - Authenticate user.
- **POST /auth/logout** - Invalidate session.
- **POST /auth/reset-password** - Trigger password reset.
- **POST /auth/change-password** - Update password.
- **POST /auth/invite-user** - Invite a new user.

### /users
- **GET /users** - List users.
- **GET /users/:id** - Get user details.
- **POST /users** - Create a user.
- **PUT /users/:id** - Update user details.
- **PUT /users/:id/deactivate** - Deactivate a user.
- **POST /users/:id/roles** - Assign role.
- **DELETE /users/:id/roles** - Revoke role.

### /products (Stitch: 5e21e469, Create: 5)
- **GET /products** - List products.
- **GET /products/:id** - Get product details.
- **POST /products** - Create product.
- **PUT /products/:id** - Update product.
- **PUT /products/:id/deactivate** - Deactivate product.
- **GET /products/search** - Search by keyword/category.
- **GET /products/barcode-lookup** - Lookup product by barcode.

### /stock (Stitch: 27c382d1, 9022f703, 559f5ad3)
- **GET /stock/balance** - Get stock balance.
- **GET /stock/movements** - List movements.
- **POST /stock/entry** - Create stock entry (Draft).
- **POST /stock/entry/:id/confirm** - Confirm entry.
- **POST /stock/exit** - Create stock exit.
- **POST /stock/exit/:id/confirm** - Confirm exit.
- **POST /stock/adjust** - Make stock adjustment.
- **POST /stock/transfer** - Transfer stock between warehouses.
- **GET /stock/extract** - Get stock extract.

### /customers (Stitch: 9, 10, 11)
- **GET /customers** - List customers.
- **GET /customers/:id** - Get customer details.
- **POST /customers** - Create a customer.
- **PUT /customers/:id** - Update customer details.
- **GET /customers/:id/balance** - Get customer balance.
- **GET /customers/:id/statement** - Get statement.

### /suppliers (Stitch: dd9e33c8, bb89dda9)
- **GET /suppliers** - List suppliers.
- **GET /suppliers/:id** - Get supplier details.
- **POST /suppliers** - Create supplier.
- **PUT /suppliers/:id** - Update supplier.
- **GET /suppliers/:id/balance** - Get supplier balance.
- **GET /suppliers/:id/statement** - Get statement.

### /documents (Stitch: 0587efb8, 7963d61f, 7aa10be2, etc.)
- **GET /documents** - List documents.
- **GET /documents/:id** - Get document details.
- **POST /documents/draft** - Create a draft document.
- **PUT /documents/:id/draft** - Update draft document.
- **POST /documents/:id/confirm** - Confirm document.
- **POST /documents/:id/cancel** - Cancel document.
- **GET /documents/search** - Search documents.
- **GET /documents/number/:number** - Get document by unique number.

### /payments (Stitch: e55e7636, ae5e4b93, 3c2a4712, f819ec0e)
- **GET /payments** - List payments.
- **GET /payments/:id** - Get payment details.
- **POST /payments/receipt** - Create customer receipt.
- **POST /payments/supplier-payment** - Create supplier payment.
- **POST /payments/:id/allocate** - Allocate payment.
- **POST /payments/:id/reverse** - Reverse payment.
- **GET /payments/:id/pdf** - Get receipt PDF.

### /reports (Stitch: 08a6bc73, 5310ba4b, b488c8ab)
- Includes various GET endpoints for stock, sales, receivables, and payables.

### /settings (Stitch: c9f0f224)
- **GET /settings** - Get system settings.
- **PUT /settings** - Update settings.
- **GET /settings/document-sequences** - List document sequences.

### /migration (Stitch: eb733c60)
- Endpoints for creating batches, uploading sources, validation, import, reconciliation, and finalizing.

## Standard Error Codes
- AUTH_REQUIRED
- PERMISSION_DENIED
- RECORD_NOT_FOUND
- INVALID_STATUS_TRANSITION
- DOCUMENT_ALREADY_CONFIRMED
- DUPLICATE_DOCUMENT_NUMBER
- DUPLICATE_SUPPLIER_INVOICE
- INSUFFICIENT_STOCK
- NEGATIVE_STOCK_NOT_ALLOWED
- PRICE_BELOW_COST_NOT_ALLOWED
- CREDIT_LIMIT_EXCEEDED
- PAYMENT_EXCEEDS_AVAILABLE_AMOUNT
- ALLOCATION_EXCEEDS_OUTSTANDING_BALANCE
- FISCAL_PERIOD_CLOSED
- MIGRATION_VALIDATION_FAILED
