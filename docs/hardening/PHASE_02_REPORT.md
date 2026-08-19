# MOVAX ERP / POS — RELATÓRIO OFICIAL DE FECHO DA PHASE 2
## SERVER-SIDE PAGINATION, SEARCH, FILTERING & LARGE DATASET READINESS
### FINAL EVIDENCE & SCOPE GATE

**Data:** 19 de Agosto de 2026  
**Status do Gate:** `PHASE_02_STATUS = PASS`  
**Autorização para Phase 3:** `READY_FOR_PHASE_03 = YES`  
**UI Freeze:** `UI_BASELINE = FROZEN` | `VISUAL_CHANGES = NONE`  
**Large Data Architecture:** `LARGE_DATA_ARCHITECTURE = PASS`  
**Large Data Load Test:** `LARGE_DATA_LOAD_TEST = NOT_LOAD-TESTED` (Agendado formalmente para a Phase 21)

---

## 1. AUDITORIA DE DIFF & ISOLAMENTO DE ESCOPO

### 1.1 Ficheiros Alterados na Phase 2 vs Baseline Phase 1 (`f4a7a1b`):
- `A` `src/shared/utils/pagination.ts` (`IN_SCOPE` - Utilitário central de paginação e normalização de sintaxe de pesquisa)
- `M` `src/features/inventory/pages/InventoryPage.tsx` (`IN_SCOPE` - Paginação, filtros e pesquisa remota de artigos)
- `M` `src/features/documents/pages/DocumentsPage.tsx` (`IN_SCOPE` - Paginação server-side e filtros de documentos operacionais)
- `M` `src/features/documents/services/documents.service.ts` (`IN_SCOPE` - Query PostgREST com contagem exata e sanitização)
- `M` `src/features/purchases/pages/PurchasesPage.tsx` (`IN_SCOPE` - Paginação e histórico de compras server-side)
- `M` `src/features/purchases/services/purchases.service.ts` (`IN_SCOPE` - Método `fetchPurchasesPage` com PostgREST server-side)
- `M` `src/features/customers/pages/EntitiesPage.tsx` (`IN_SCOPE` - Paginação server-side e directórios de clientes/fornecedores)
- `M` `src/features/customers/services/parties.service.ts` (`IN_SCOPE` - Sanitização de queries PostgREST para entidades)
- `A` `tests/unit/pagination.test.ts` (`REQUIRED_SUPPORTING_CHANGE` - Testes do utilitário de paginação)
- `A` `tests/unit/services.test.ts` (`REQUIRED_SUPPORTING_CHANGE` - Testes de contratos de serviços)
- `A` `docs/hardening/PHASE_02_REPORT.md` (`REQUIRED_SUPPORTING_CHANGE` - Relatório e matriz de evidências)

### 1.2 Matriz de Out-of-Scope & Isolamento:
| Alteração | Fase Original | Acção Tomada no Gate | Destino / Justificação |
| :--- | :--- | :--- | :--- |
| **M-Pesa / Bank Checkout Modals** | Phase 14+ (Billing) | `DEFERRED_TO_BILLING_PHASE` | Isolado na branch `feature/billing-bank-transfer-and-mpesa`. Código revertido no branch de hardening. |
| **Decomposição do POS (`PosPage.tsx`)** | Phase 3 (POS Structural) | `DEFERRED_TO_PHASE_03` | Nenhuma decomposição iniciada nesta fase. |
| **Decomposição de Stock Transfers** | Phase 4 | `DEFERRED_TO_PHASE_04` | Intocado. |
| **Decomposição de Cotações** | Phase 5 | `DEFERRED_TO_PHASE_05` | Intocado. |

---

## 2. MATRIZ FINAL DE TODOS OS DATASETS DA PLATAFORMA

| Dataset | Estratégia | Total Count | Pesquisa | Filtros | Full Array em Memória? | Classificação / Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Produtos / Catálogo** | `SERVER` | `YES` (RPC `get_products_page_v1`) | `SERVER` | `SERVER` | `NO` | `TRUE_SERVER_PAGINATION` (PASS) |
| **Documentos Operacionais** | `SERVER` | `YES` (`count: exact` PostgREST) | `SERVER` | `SERVER` | `NO` | `TRUE_SERVER_PAGINATION` (PASS) |
| **Compras a Fornecedores** | `SERVER` | `YES` (`count: exact` PostgREST) | `SERVER` | `SERVER` | `NO` | `TRUE_SERVER_PAGINATION` (PASS) |
| **Clientes (Directório)** | `SERVER` | `YES` (`count: exact` PostgREST) | `SERVER` | `SERVER` | `NO` | `TRUE_SERVER_PAGINATION` (PASS) |
| **Fornecedores (Directório)** | `SERVER` | `YES` (`count: exact` PostgREST) | `SERVER` | `SERVER` | `NO` | `TRUE_SERVER_PAGINATION` (PASS) |
| **Movimentos de Stock** | `SERVER` | `YES` (RPC `get_stock_movements_page_v2`) | `SERVER` | `SERVER` | `NO` | `TRUE_SERVER_PAGINATION` (PASS) |
| **Extrato de Artigo** | `SERVER` | `YES` (RPC `get_product_movements_extract_v1`) | `SERVER` | `SERVER` | `NO` | `TRUE_SERVER_PAGINATION` (PASS) |
| **Sessão Activa de Caixa** | `DIRECT_RPC` | `N/A` (1 sessão activa) | `N/A` | `N/A` | `NO` | `NOT_APPLICABLE` (Dataset unitário/operacional) |
| **Histórico de Caixas (Turnos)** | `SERVER_LIMIT` | `N/A` (RPC limitado a últimos 20 turnos) | `N/A` | `N/A` | `NO` | `NOT_APPLICABLE` (Bounded subset recente) |
| **Pagamentos / Contas Correntes** | `ON_DEMAND` | `N/A` (Carregado por documento/cliente) | `SERVER` | `SERVER` | `NO` | `NOT_APPLICABLE` (Contextual a documento/entidade) |
| **Lookup de Artigos no POS** | `SERVER_SEARCH`| `N/A` (`InventoryService.searchProducts` c/ warehouse) | `SERVER` | `SERVER` | `NO` | `TRUE_SERVER_SEARCH` (PASS) |

---

## 3. AUDITORIA DE IMPLEMENTAÇÃO REAL

1. **Documentos Operacionais (`DocumentsPage.tsx`):**
   - Consome directamente `DocumentsService.fetchDocumentsPage()`.
   - Tabela renderiza `serverDocuments` com paginação orientada por `serverDocumentsTotal`.
   - `search reset`: ao alterar pesquisa ou filtros, `setPage(1)` é executado.
   - Zero `.slice()` sobre o array total de documentos para paginação.

2. **Compras a Fornecedores (`PurchasesPage.tsx`):**
   - Consome directamente `PurchasesService.fetchPurchasesPage()`.
   - Tabela renderiza `serverPurchases` com paginação orientada por `serverPurchasesTotal`.
   - Zero `documents.filter().slice()` sobre dataset empresarial.

3. **Directório de Entidades (`EntitiesPage.tsx`):**
   - Estados independentes para Clientes e Fornecedores (`serverClients`, `serverClientsTotal`, `serverSuppliers`, `serverSuppliersTotal`).
   - Tabela consome directamente `PartiesService.fetchCustomersPage` e `PartiesService.fetchSuppliersPage`.

4. **Lookup de Artigos no POS (`PosPage.tsx`):**
   - O POS **não descarrega todo o catálogo** de artigos na abertura.
   - Utiliza `ArticleSearchSelect` conectado a `articleSearchLoader` -> `InventoryService.searchProducts(query, warehouseId, 50)`, respeitando estritamente o `warehouseId` activo do terminal.

5. **`loadAppData('all')` Audit:**
   - Confirmado: `loadAppData('all')` **não é chamado** no ciclo de vida da aplicação.

6. **Normalização de Sintaxe PostgREST (`sanitizePostgrestSearch`):**
   - Comportamento testado e verificado:
     - `Mário & Filhos, Lda.` -> `Mário & Filhos Lda.` (remove vírgula que quebrava o operador `.or()`)
     - `100% Peças` -> `100 Peças` (remove wildcard `%`)
     - `A_B Comercial` -> `AB Comercial` (remove wildcard `_`)
     - `Auto (Maputo)` -> `Auto Maputo` (remove parênteses)
     - `José\Auto` -> `JoséAuto` (remove escape `\`)
   - Classificação: **search filter syntax normalization** (evita erros 400 Bad Request no PostgREST sem corromper a busca).

---

## 4. EVIDÊNCIA DE TESTES E INTEGRIDADE

- **Testes Unitários (Vitest):** `7/7` suites, `39/39` testes com **100% PASS** (~235ms).
- **`npm run check`:**
  - Security audit: **PASS** (0 chaves expostas).
  - Static operational data audit: **PASS** (Branding neutro).
  - Migration rollback: **PASS**.
  - TypeScript (`tsc`): **PASS** (0 erros).
  - Vite production build: **PASS** (`dist/` gerado com sucesso).
- **UI Freeze:** **100% respeitado** (`VISUAL_CHANGES = NONE`).

---

## 5. DECISÃO FINAL DO GATE

- [x] Zero classificações híbridas em datasets empresariais.
- [x] Alterações de billing/M-Pesa isoladas em branch próprio.
- [x] Todos os datasets classificados e verificados.
- [x] Sem claims de performance falsos ou não medidos.
- [x] Testes unitários e build de produção 100% limpos.

```ini
PHASE_02_STATUS = PASS
READY_FOR_PHASE_03 = YES
```
