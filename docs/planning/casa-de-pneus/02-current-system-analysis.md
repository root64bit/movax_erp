# Current System Analysis: XT-POS PRO v3.50

## 1. Overview of the Legacy Platform
Casa de Pneus currently operates on **XT-POS PRO v3.50**, a legacy Point-of-Sale and inventory management application.
*   **Operating System:** Windows XP (desktop application)
*   **Application Type:** Standalone Windows Executable (.exe)
*   **Network:** The system runs entirely locally on a single machine. There is no local area network (LAN) setup for multi-user concurrent access.
*   **Architecture:** Monolithic desktop application with a local database engine.

## 2. Likely Database Engines
Due to the era of the software (Windows XP, mid-2000s legacy POS), the underlying database engine is likely one of the following:
*   **DBF / FoxPro / dBase:** Highly common for older desktop accounting tools.
*   **Firebird / Interbase:** Often used in older Delphi or C++ Builder applications.
*   **Btrieve / Pervasive SQL:** Common in legacy transactional systems.
*   **Paradox or MS Access (MDB):** Common for smaller-scale desktop apps.
*   **Proprietary / Flat Files:** Custom binary or text formats.

*Note: Identifying the exact database schema and format is a critical prerequisite for the data migration phase.*

## 3. Known System Capabilities
Based on current usage and business processes, XT-POS PRO v3.50 successfully handles the following functions:
*   **Articles & Inventory:** Managing tire inventory, processing Stock Entries (Entradas) and Stock Exits (Saídas).
*   **Entities:** Maintaining simple records for Customers (Clientes) and Suppliers (Fornecedores).
*   **Sales Processing:** Generating Delivery Notes (Guias de Remessa), Invoices (Facturas), Cash Sales (Venda a Dinheiro), and Credit/Debit Notes (Notas de Crédito/Débito).
*   **Current Accounts (Contas Correntes):** Tracking the ongoing balances (credits and debits) of Customers and Suppliers.
*   **Payments:** Recording full and partial payments, linking them to open documents.
*   **Reporting & Printing:** Generating basic reports (stock lists, sales summaries) and printing documents on local dot-matrix or thermal printers.

## 4. Operational Constraints and Pain Points
The business currently suffers from significant limitations due to the legacy system:
*   **Single Point of Failure:** Operating on a single Windows XP machine represents an extreme hardware and security risk.
*   **No Concurrent Access:** Because it operates on a single machine, only one user can process sales, enter stock, or generate reports at any given time.
*   **Lack of Automation:** No automated backup mechanisms exist, relying entirely on manual intervention.
*   **No Audit Trail:** Security and accountability are non-existent; it is impossible to reliably track which user made which modification at what time.

## 5. Key Risks during Migration
*   **Data Loss or Corruption:** Extracting data from a potentially degraded Windows XP hard drive.
*   **Character Encoding:** Legacy systems often use Windows-1252 or ISO-8859-1. Converting Portuguese characters (ç, ã, á) to UTF-8 without corruption is critical.
*   **Date Format Ambiguity:** Extracting dates correctly (differentiating between DD/MM/YYYY and MM/DD/YYYY formats stored internally).
*   **Unknown Schema & Integrity:** The legacy database may lack foreign keys, leading to orphaned records (e.g., invoices for deleted customers).

## 6. What Must Be Preserved (Migration Mandates)
To ensure a seamless transition and maintain fiscal continuity, the following must be flawlessly migrated and preserved:
1.  **Historical Data:** All past sales, purchases, and payments for reference.
2.  **Document Numbering Sequences:** The new system must continue the exact numbering sequences (e.g., Factura FT 2023/1234 -> FT 2023/1235) to satisfy tax and accounting rules.
3.  **Financial Balances:** Customer and Supplier Current Account balances must match down to the cent (MZN).
4.  **Stock Quantities:** The exact physical and logical stock quantities mapped to their respective articles.
