# MOVAX ERP — RELATÓRIO DE HARDENING: FASE 1

**Data:** 19 de Agosto de 2026  
**Objectivo:** Desacoplar `src/lib/appData.ts` em serviços de domínio dedicados e eliminar o carregamento monolítico global sem alterar UX ou introduzir regressões visuais.  
**Estado:** `PHASE_01_STATUS = PASS`

---

## 1. Scope Autorizado

- [x] Mapear e decompor as responsabilidades de `src/lib/appData.ts`
- [x] Consolidar e equipar serviços de domínio em `src/features/*/services/`:
  - `src/features/inventory/services/inventory.service.ts`
  - `src/features/sales/services/sales.service.ts`
  - `src/features/quotations/services/quotation.service.ts`
  - `src/features/purchases/services/purchases.service.ts`
  - `src/features/documents/services/documents.service.ts`
  - `src/features/cash/services/cash.service.ts`
  - `src/features/customers/services/parties.service.ts`
  - `src/features/administration/services/administration.service.ts`
  - `src/features/stock-transfers/services/stockTransfers.service.ts`
  - `src/features/subscriptions/services/subscription.service.ts`
- [x] Migrar consumidores directos de `appData.ts` para os novos serviços de domínio (`PrivateRoutes.tsx`, `AccountsPage.tsx`, `StockMovementsPage.tsx`, `ArticleLedgerModal.tsx`)
- [x] Preservar compatibilidade total de contratos, tipos e queries
- [x] Manter UI Baseline estritamente congelada (**UI_BASELINE = FROZEN**)

---

## 2. Ficheiros Modificados

1. `src/features/inventory/services/inventory.service.ts` — Adicionados métodos `fetchStockMovementsPage`, `fetchStockMovementExtract`, tipagens `StockExtractResult` e `StockMovementsPageResult`.
2. `src/features/cash/services/cash.service.ts` — Adicionado método `fetchCashSessions` e mapeamento de sessões de caixa.
3. `src/features/stock-transfers/services/stockTransfers.service.ts` — Adicionados métodos `saveStockGuide`, `cancelStockGuide` e `cancelTransfer`.
4. `src/features/documents/services/documents.service.ts` — Adicionado método `cancelFinancialAdvice`.
5. `src/features/quotations/services/quotation.service.ts` — Adicionado método `saveCompanyQuotationSettings`.
6. `src/features/administration/services/administration.service.ts` — Adicionados métodos `setOperationalContext`, `createUser` e `updateUser`.
7. `src/app/router/PrivateRoutes.tsx` — Migradas chamadas de mutação e contexto para os serviços de domínio (`StockTransfersService`, `DocumentsService`, `QuotationService`, `AdministrationService`).
8. `src/features/cash/pages/AccountsPage.tsx` — Desacoplado de `appData.ts`, consumindo directamente `CashService.fetchCashSessions`.
9. `src/features/inventory/components/ArticleLedgerModal.tsx` — Desacoplado de `appData.ts`, consumindo directamente `InventoryService.fetchStockMovementExtract`.
10. `src/features/stock-transfers/pages/StockMovementsPage.tsx` — Desacoplado de `appData.ts`, consumindo directamente `InventoryService.fetchStockMovementsPage`.
11. `src/features/pos/utils/posCalculations.ts` & `src/features/quotations/utils/quotationCalculations.ts` — Tipagens de cálculo puras alinhadas ao padrão de domínio.
12. `vitest.config.ts` — Configuração para isolar suíte unitária de testes E2E.

---

## 3. Behaviour Changes

- **Alterações de Comportamento:** `NONE` (Zero alterações na experiência operacional).
- Todos os fluxos de caixa, vendas, cotações, compras, emissão de guias, anulações e transferências mantêm os mesmos parâmetros e retornos esperados.

---

## 4. Visual Changes

- **Alterações Visuais:** `NONE` (Zero alterações no layout, botões, modais, formulários ou tabelas).

---

## 5. Testes Executados e Resultados

### Suíte Vitest (Unit Tests):
```bash
npx vitest run
```
**Resultado:**
```
✓ tests/unit/cashCalculations.test.ts (2 tests)
✓ tests/unit/stockCalculations.test.ts (4 tests)
✓ tests/unit/posCalculations.test.ts (5 tests)
✓ tests/unit/entitlements.test.ts (4 tests)

Test Files: 4 passed (4)
Tests: 15 passed (15)
```

### Validação Geral do Projecto:
```bash
npm run check
```
- Audit de Segurança: `PASS` (zero chaves expostas)
- Audit de Dados Estáticos: `PASS` (branding neutro multiempresa)
- Contract Migration 016 Rollback: `PASS`
- TypeScript Typecheck (`tsc`): `PASS` (0 erros)
- Vite Production Build: `PASS` (`built in 6.59s`)

---

## 6. Issues Found & Deferred

- Nenhuma vulnerabilidade crítica ou corrupção de dados identificada.
- A paginação server-side com filtros profundos nas listagens de inventário e movimentos de stock está pronta para ligação na **Fase 2**.

---

## 7. Gate Status

```text
PHASE_01_STATUS = PASS

READY_FOR_PHASE_02 = YES
```
