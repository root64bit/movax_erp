# Executive Summary: Casa de Pneus, Lda. Management System Modernization

## 1. Project Overview
Casa de Pneus, Lda. is a well-established tire shop located in Mozambique. The business currently relies on an outdated, legacy point-of-sale and inventory management system, **XT-POS PRO v3.50**, which is running on the obsolete **Windows XP** operating system. 

This project aims to completely replace the legacy software with a modernized, web-based platform tailored exactly to the operational workflows of Casa de Pneus. The new system will provide high reliability, robust data integrity, advanced access control, and comprehensive reporting capabilities.

## 2. Business Drivers and Objectives
*   **Hardware Modernization & Reliability:** Migrate away from a single point of failure (Windows XP machine) which poses an imminent risk of critical hardware/software failure.
*   **Data Security & Accessibility:** Ensure zero data loss moving forward by migrating to a resilient, cloud-backed data model, moving away from local-only storage.
*   **Operational Efficiency:** Standardize business workflows around Catalogue, Inventory, Sales, Purchases, and Accounting, minimizing manual errors and reconciliation effort.
*   **Scalability:** Prepare the business for potential multi-branch and multi-user concurrent operations, which is impossible under the current single-computer paradigm.
*   **Regulatory & Fiscal Compliance:** Provide a modern audit trail and exact document numbering, crucial for accurate tax reporting and compliance in Mozambique.

## 3. Proposed Architecture
The new application will be a modern, web-based single-page application (SPA) supported by a robust backend as a service:
*   **Frontend Framework:** React + Next.js (App Router)
*   **Language:** TypeScript for end-to-end type safety
*   **Styling & UI:** Tailwind CSS, utilizing a bespoke "Sistema de Gestão Operacional" design system (Modernized Utilitarianism theme, utilizing Inter font, 4px baseline grid, 240px sidebar, and keyboard-first accessibility). Primary color: `#003366`, Secondary/Success: `#006e25`/`#28A745`, Error: `#ba1a1a`/`#DC3545`.
*   **Backend & Database:** Supabase (PostgreSQL). Utilizing `UUID` for keys, `NUMERIC` for precise currency calculations, and `TIMESTAMPTZ` for dates.
*   **Authentication:** Supabase Auth integrated with custom Role-Based Access Control (RBAC).
*   **Localization:** Portuguese (MZ) UI, with MZN (Metical) currency and DD/MM/YYYY date formats.

## 4. Key Modules
1.  **Articles:** Master data for products and services.
2.  **Stock (Inventory):** Managing quantities, entries (Entrada de Stock), exits (Saída de Stock), and adjustments.
3.  **Sales (Commercial):** Processing quotes, delivery notes (Guia de Remessa), invoices (Factura), cash sales, credit notes (Nota de Crédito), and debit notes (Nota de Débito).
4.  **Purchases (Procurement):** Supplier delivery notes, supplier invoices, and credit/debit notes from suppliers.
5.  **Payments:** Managing supplier payments and customer receipts, handling partial distributions.
6.  **Current Accounts (Contas Correntes):** Tracking open balances, debit/credit ledgers for both Customers and Suppliers.
7.  **Reports:** Comprehensive insights into Stock, Sales, and Accounts Payable/Receivable.
8.  **Migration & Administration:** Tools for historical data ingestion, user management, profile creation, and system configurations.

## 5. System Scale
*   **Database Footprint:** The new PostgreSQL schema will comprise approximately **50+ tables** to handle normalized entities for master data, documents, document lines, payment distributions, user profiles, and operational logs.
*   **User Interface:** The system features 35 distinct application screens, of which 29 have already been planned/designed in Stitch, catering to all major workflows.

## 6. Authentication and Access Control
The authentication model leverages **Supabase Auth** for identity management combined with an internal **Role-Based Access Control (RBAC)** system. 
Users will be assigned specific Profiles (e.g., Administrator, Manager, Cashier), which dictate exactly which screens they can view, create, edit, or delete items within.

## 7. Implementation Roadmap Summary
The implementation is broken down into a 15-phase roadmap:
1.  **Foundation & Environment Setup:** Next.js scaffolding, Supabase project setup.
2.  **Design System Implementation:** Tailwind config, component library setup.
3.  **Identity & RBAC:** Users, Profiles, Permissions.
4.  **Core Master Data:** Articles, Settings, Tax tables.
5.  **Entities:** Customers, Suppliers, and Addresses.
6.  **Inventory Foundation:** Warehouses, initial stock balances.
7.  **Inventory Movements:** Stock Entries and Exits.
8.  **Sales Flow:** Delivery Notes, Invoices.
9.  **Purchases Flow:** Supplier documents.
10. **Financial Ledger:** Customer/Supplier Current Accounts structure.
11. **Payments & Receipts:** Handling MZN financial transactions.
12. **Reporting Engine:** Sales, Stock, and Accounts reports.
13. **Data Migration Tools:** Importers for XT-POS PRO v3.50 legacy data.
14. **UAT & Training:** User Acceptance Testing.
15. **Deployment & Go-Live:** Final cutover and production launch.

## 8. Major Risks and Mitigations
*   **Legacy Data Format Unknown:** XT-POS PRO v3.50 data structures are undocumented. **Mitigation:** Allocate dedicated time for reverse-engineering the data format (DBF, Firebird, or proprietary) early in phase 13.
*   **Stock Reconciliation:** Aligning logical stock from an old system with physical reality can be challenging. **Mitigation:** Perform a comprehensive physical stock take immediately prior to Go-Live.
*   **Fiscal Compliance:** Mozambique tax regulations may require certified billing software. **Mitigation:** Ensure document hashing, immutable document numbering, and detailed audit trails are implemented from day one.

## 9. Timeline Estimation Guidance
While the exact timeline depends on team velocity, the project can be estimated as a **12 to 16-week effort** for a standard cross-functional agile team (2 Frontend, 1 Backend/DB, 1 QA, 1 PM), given the pre-existing UI designs and clear domain boundaries.
