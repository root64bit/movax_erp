# Casa de Pneus — Legacy XT-POS Migration Assessment

## Source inspected

- Archive: `Pos.zip`
- SHA-256: `c666a1d4bccf57f390e5b433483a733b6bd5e67d582974d17fe758c85858af1c`
- Archive entries: 943
- Uncompressed size: 183,302,205 bytes
- Primary database family: xBase / dBase III / FoxBase+ used by a Clipper-style application
- Primary data files: DBF
- Index files: NTX
- Memo files: DBT
- Likely text encoding: CP850, subject to table-by-table validation

This archive is a real legacy database package and contains substantial business data. It is not an empty staging export.

## Important correction to earlier assumptions

The database is not a Visual FoxPro/CDX/FPT set. The inspected archive uses dBase III/FoxBase-compatible DBF files, NTX indexes and DBT memo files. The migration extractor should therefore target xBase/Clipper-compatible formats.

## Main source tables and active records

| Source table | Likely purpose | Active | Deleted |
|---|---|---:|---:|
| `FACMTAR.DBF` | Articles/products master | 535 | 0 |
| `FACMTCF.DBF` | Customers and suppliers | 104 | 1 |
| `FACMTFA.DBF` | Commercial document headers | 14,691 | 2,038 |
| `FACLNFA.DBF` | Commercial document lines | 167,501 | 40,040 |
| `FACMVAR.DBF` | Article/stock movements | 173,310 | 46,225 |
| `FACMVCF.DBF` | Customer/supplier financial movements | 14,939 | 2,049 |
| `FACMTRE.DBF` | Receipt/payment headers | 243 | 11 |
| `FACLNRE.DBF` | Receipt allocations/details | 653 | 65 |
| `FACMTST.DBF` | Direct stock movement headers | 4,568 | 703 |
| `FACLNST.DBF` | Direct stock movement lines | 12,589 | 7,983 |
| `FACMTVD.DBF` | Document party snapshots | 8,614 | 1,621 |
| `FACMTAL.DBF` | Debit/credit advice headers | 5 | 0 |
| `FACLNAL.DBF` | Debit/credit advice lines | 5 | 0 |

`FACMTCF.DBF` contains 101 active customer records and 3 active supplier records, distinguished by the `MODULO` field.

## Article and stock observations

- Active articles: 535
- Positive stock: 321 articles
- Zero stock: 212 articles
- Negative stock: 2 articles
- Sum of stored article existence: 11,447 units
- Duplicate active article codes detected: 0
- Duplicate nonblank EAN values detected: 0

The stored existence must still be reconciled against the movement history before it is trusted as the production opening balance.

## Commercial document types found

The document configuration table `FACDOC.DBF` defines, among others:

- `CF` — Factura
- `CV` — Venda a dinheiro
- `CG` — Guia de remessa
- `CP` — Guia de transporte
- `CN` — Nota de crédito
- `CD` — Aviso de lançamento a débito
- `CC` — Aviso de lançamento a crédito
- `CR` — Recibo
- `CO` — Factura proforma
- `FF` — Factura de fornecedor
- `FN` — Nota de devolução de fornecedor
- `FD` — Aviso de débito de fornecedor
- `FC` — Aviso de crédito de fornecedor
- `FR` — Pagamento de fornecedor
- `SE` — Entrada directa
- `SS` — Saída directa
- `SI` — Inventário

Active document headers found in `FACMTFA.DBF`:

| Prefix | Meaning | Active count |
|---|---|---:|
| `CV` | Venda a dinheiro | 8,614 |
| `CF` | Factura | 6,066 |
| `CG` | Guia de remessa | 4 |
| `FN` | Nota de devolução de fornecedor | 3 |
| `CN` | Nota de crédito | 2 |
| `CO` | Factura proforma | 1 |
| `CP` | Guia de transporte | 1 |

No active `FF` supplier invoices were found in this main document header table. Supplier-purchase history must therefore be verified before assuming it is complete.

## Relationships confirmed from the source

- `FACMTFA.DOC` is an 8-character document key such as a type prefix plus number.
- `FACLNFA.DOC` contains the header key followed by a two-digit line sequence.
- `FACMVAR.DOC` follows the same header-plus-line pattern for stock movements.
- `FACMTST.DOC` and `FACLNST.DOC` represent direct stock movement headers and lines.
- `FACMTRE.DOC` is the receipt header key.
- `FACLNRE.DOC` is the receipt key followed by a line sequence.
- `FACLNRE.DOCJUST` references the document settled, but the source uses a shortened or normalized form that needs an explicit mapping rule.
- `NUMCF` links documents and financial movements to a customer or supplier in `FACMTCF`.
- `CODIGO` links document lines and stock movements to an article in `FACMTAR`.

## Recommended mapping to the current Supabase project

| Legacy source | Current target domain |
|---|---|
| `FIRMA.DBF` | Company legal and contact settings |
| `CONFIG.DBF`, `FACGER.DBF` | Reviewed configuration only; do not copy blindly |
| `FACIVA.DBF` | Tax codes/rates |
| `FACMED.DBF` | Units of measure |
| `FACPAG.DBF` | Split into payment terms and payment methods |
| `FACCAMB.DBF` | Currencies/exchange-rate history if required |
| `FACDOC.DBF` | Document-type map and legacy sequence evidence |
| `FACMTAR.DBF` | Products/articles |
| `FACMTCF.DBF` | Customers and suppliers, split by `MODULO` |
| `FACMTFA.DBF` | Document headers |
| `FACLNFA.DBF` | Document lines |
| `FACMTVD.DBF` | Historical party snapshots on documents |
| `FACMVAR.DBF` | Historical stock movements |
| `FACMTST.DBF`, `FACLNST.DBF` | Direct entry/exit documents and lines |
| `FACMVCF.DBF` | Customer/supplier ledger and current-account evidence |
| `FACMTRE.DBF` | Customer receipt/payment headers |
| `FACLNRE.DBF` | Receipt-to-document allocations |
| `FACMTAL.DBF`, `FACLNAL.DBF` | Credit/debit advice headers and lines |
| `FACVEND.DBF` | Historical salesperson/operator references only |
| `FACZONA.DBF`, `FACPOST.DBF` | Optional reference data |

## Data-quality and migration blockers to resolve

1. **Deleted records**
   - Tens of thousands of DBF rows carry the xBase deleted marker.
   - They must not be imported as active records.
   - They should be counted and retained in an archive/reconciliation layer.

2. **Invalid legacy dates**
   - 11 active document headers have invalid date encodings.
   - 119 active stock movement rows have invalid date encodings.
   - Receipt allocation dates include 233 blank values plus several invalid values.
   - These require an explicit correction or exception rule; they must not be silently changed.

3. **Three-decimal money values**
   - Source values generally use three decimal places.
   - The current project commonly uses two-decimal monetary values.
   - Rounding must be defined per document and reconciled so totals do not drift.

4. **Encoding**
   - CP850 is strongly indicated by Portuguese characters in source bytes.
   - The extractor must validate encoding per table and preserve raw bytes or hashes.

5. **Payment history completeness**
   - Active receipt headers total 243 and appear to end much earlier than the document history.
   - The financial movement table is broader and must be used to reconcile balances.
   - Do not rebuild current accounts from receipts alone.

6. **Supplier purchasing history**
   - Supplier master records exist, but no active `FF` supplier invoices were found in the main header table.
   - Verify whether supplier purchases were stored elsewhere, omitted, or not used.

7. **Temporary work tables**
   - Most `W*.DBF` files are temporary/report working tables with repeated schemas.
   - They should not be treated as primary source tables unless a reconciliation gap proves they contain unique required information.

8. **No-extension program files**
   - Hundreds of no-extension files appear to be application/runtime overlays or compiled components, not primary business tables.
   - Preserve and inventory them, but exclude them from the first data import.

## Safe migration sequence

### Phase 1 — Preservation and extractor

- Preserve `Pos.zip` read-only using the recorded SHA-256.
- Build a CP850-aware xBase extractor for DBF and DBT.
- Ignore NTX for data truth; use it only as relationship evidence.
- Produce JSONL raw exports and a signed manifest.
- Preserve deleted flags, record numbers, raw hashes and source filenames.

### Phase 2 — Raw staging only

Create one isolated migration batch, for example:

`XTPOS_POS_20260804_FULL_RAW`

Load into the existing `migration` schema only:

- company/settings raw
- reference raw
- product raw
- party raw
- document header raw
- document line raw
- stock movement raw
- payment raw
- allocation raw
- current-account raw

Do not write final operational tables yet.

### Phase 3 — Mapping and validation

Approve mappings for:

- document types
- taxes
- units
- payment terms
- payment methods
- customer/supplier distinction
- stock movement direction
- document status
- article codes
- party numbers

Validate every parent-child relationship and register every orphan.

### Phase 4 — Dry transformation

Run transformations in dependency order:

1. Company/reference data
2. Products
3. Customers and suppliers
4. Direct stock headers and lines
5. Commercial document headers and lines
6. Stock movements
7. Credit/debit advice
8. Receipts/payments
9. Allocations
10. Current accounts
11. Sequences

Do not execute final APPLY during the first run.

### Phase 5 — Reconciliation

Require zero unexplained variance for:

- source vs raw record counts
- article count
- document count and line count
- net, IVA and total values per document
- stock quantity per article
- receipt/payment totals
- allocation totals
- customer balance per customer
- supplier balance per supplier
- maximum document numbers and safe next sequence

### Phase 6 — Approved APPLY

Only after technical and business approval:

- take a fresh production backup
- lock the migration batch
- apply in bounded chunks
- keep the application in `MIGRATION`
- reconcile again
- finalise the migration batch
- only then consider PILOT activation

## Recommended migration strategy

A full-history migration is technically feasible: the active core dataset is large but moderate for PostgreSQL/Supabase. However, because receipt history appears incomplete and some dates are invalid, the correct first deliverable is a complete raw import and dry-run reconciliation—not a direct production APPLY.

The present archive is sufficient to start WP10B extraction and staging immediately. It is not yet sufficient to safely complete WP10D without the documented mapping and reconciliation decisions.
