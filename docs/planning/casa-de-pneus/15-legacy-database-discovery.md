# Legacy Database Discovery Plan: XT-POS PRO v3.50

## 1. Objective
To safely and comprehensively identify, analyze, and map the underlying database of the legacy XT-POS PRO v3.50 system running on Windows XP at Casa de Pneus, Lda.

## 2. Discovery Process

### Step 1: Locate the Executable
- Find the shortcut used to launch XT-POS PRO on the Windows XP machine.
- Right-click the shortcut -> Properties -> find the "Target" and "Start In" paths.
- Navigate to the installation directory.

### Step 2: Locate Data Files
- Search the installation directory and subdirectories (e.g., `\Data`, `\DB`) for database file extensions.
- Check environment variables or configuration files for custom data paths.
- Look for recently modified files to confirm which data store is actively being used.

### Step 3: Identify Configuration Files
- Look for `.ini`, `.cfg`, `.xml`, or `.txt` files in the application directory.
- Check for connection strings, database paths, usernames, passwords, or port numbers.

### Step 4: Inspect ODBC / BDE Connections
- Open `odbcad32.exe` (Data Sources (ODBC) in Control Panel).
- Check User DSN and System DSN tabs for entries related to XT-POS.
- Note the driver used (e.g., Microsoft Access Driver, Firebird/Interbase, SQL Server).
- If Borland Database Engine (BDE) is installed, check the BDE Administrator for alias configurations.

### Step 5: Identify the Database Engine
Based on file extensions and ODBC configs:
- `.dbf`, `.cdx`, `.fpt` -> DBF / FoxPro / dBase
- `.fdb`, `.gdb` -> Firebird / Interbase
- `.db`, `.px`, `.mb` -> Paradox (common in older Delphi apps like XT-POS)
- `.mdb` -> Microsoft Access
- `.btr`, `.mkd` -> Btrieve / Pervasive SQL

## 3. Tools for Specific Engines
- **DBF / FoxPro**: DBF Viewer 2000, CDBF, or standard Python `dbfread` library.
- **Firebird**: FlameRobin, Firebird ISQL Tool.
- **Paradox**: Paradox Data Editor, Paradox dBase Reader, BDE standard tools.
- **Access**: Microsoft Access (older versions like 2003/2007 for compatibility), MDB Viewer Plus.
- **Btrieve**: Pervasive Control Center, Btrieve File Saver.

## 4. Character Encoding Analysis
- Windows XP in Mozambique typically uses:
  - `CP1252` (Windows Western European)
  - `ISO-8859-1` (Latin-1)
  - Less common: MS-DOS code pages (e.g., CP850).
- Extract sample text containing special Portuguese characters (ç, ã, á, é, í, ó).
- View the raw hex bytes to determine the encoding and define the transformation rules for UTF-8 conversion in the target system.

## 5. Schema Reverse Engineering
- If the database is relational (Firebird/Access), extract the DDL (CREATE TABLE statements, constraints, foreign keys).
- If flat files (DBF, Paradox), map out the field names, types, and lengths using viewer tools.
- Identify primary keys, foreign key relationships (often implicit in older systems), and indexes.
- Identify the core tables: Products/Articles, Customers, Suppliers, Invoices/Receipts headers and lines.

## 6. Data Sampling Procedures
- Export a small subset (e.g., 100 rows) of key tables to CSV.
- Analyze the CSVs to understand data entry patterns, null handling, missing fields, and anomalies.
- Check date formats (e.g., DD/MM/YYYY vs MM/DD/YYYY, or epoch formats).
- Verify how decimals and currency values are stored (e.g., integer cents vs floats).

## 7. Risk Assessment Checklist
- [ ] Is the database proprietary, encrypted, or password-protected? (Need to find credentials in config or reverse engineer).
- [ ] Is the database corrupted? (Run integrity checks using native tools).
- [ ] Are there active locks preventing file copying? (Ensure XT-POS is closed before attempting data copying).
- [ ] Does the system rely on external files (e.g., images, PDFs) that aren't stored in the DB?
- [ ] Is the hard drive of the Windows XP machine failing? (Prioritize full disk imaging immediately).
