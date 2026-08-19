# MOVAX ERP — RELATÓRIO OFICIAL DE FECHO DA PHASE 4
## STOCK MOVEMENTS & TRANSFERS STRUCTURAL DECOMPOSITION

**Data:** 20 de Agosto de 2026  
**Status do Gate:** `PHASE_04_STATUS = PASS`  
**Autorização para Phase 5:** `READY_FOR_PHASE_05 = YES`  
**UI Freeze:** `UI_BASELINE = FROZEN` | `VISUAL_CHANGES = NONE`  
**Database Schema:** `DATABASE_SCHEMA_CHANGED = NO` | `MIGRATIONS_ADDED = 0`  
**New Features:** `NEW_FEATURES = NONE`  
**Visual Review:** `CURRENT_UI_MANUAL_REVIEW = PASS`  
**Visual Parity Pre-Phase:** `VISUAL_PARITY_WITH_PRE_PHASE_SCREENSHOT = NOT_VERIFIED` (Classificação honesta sem baseline pré-fase arquivado)  
**E2E Automation:** `E2E_AUTOMATION = NOT_AVAILABLE` (Execução local sem credenciais de staging)  

---

## 1. OBJECTIVO E ESCOPO DA PHASE 4

A Phase 4 teve como objectivo a decomposição estrutural do God Component:
```text
src/features/stock-transfers/pages/StockMovementsPage.tsx
```
Reduzindo a sua complexidade de **1.626 linhas** para uma arquitectura modular, desacoplada, tipada e facilmente auditável, sem alterar as regras de stock, atomicidade, state machine ou layout visual.

---

## 2. ANÁLISE COMPARATIVA DE LINHAS DE CÓDIGO (BEFORE VS AFTER)

| Ficheiro / Módulo | Linhas Before | Linhas After | Responsabilidade |
| :--- | :---: | :---: | :--- |
| `pages/StockMovementsPage.tsx` | **1.626** | **274** | Orquestrador limpo de estados de página e composição |
| `components/DirectMovementSection.tsx` | — | **478** | Formulário de entrada/saída direta, pesquisa de artigos e grelha |
| `hooks/useDirectStockMovement.ts` | — | **340** | Gestão do rascunho de guia direta, submissão atómica e validações |
| `components/MovementHistorySection.tsx` | — | **235** | Tabela de histórico paginada no servidor, filtros e exportação CSV |
| `components/StockTransferSection.tsx` | — | **221** | Criação e preparação de guias de transferência entre armazéns |
| `hooks/useStockTransfersManagement.ts` | — | **215** | Ciclo de vida e operações de transferência (criar, enviar, receber, anular) |
| `services/stockTransfers.service.ts` | 167 | **167** | Serviço de integração e chamadas RPC com PostgreSQL/Supabase |
| `components/TransferHistorySection.tsx` | — | **128** | Tabela de guias de transferência com acções operacionais |
| `hooks/useStockMovementHistory.ts` | — | **117** | Paginação server-side, debounce e filtros do histórico |
| `components/StockModeSelector.tsx` | — | **81** | Navegação em abas de modo (Entrada, Saída, Transferência) |
| `components/CancelGuideModal.tsx` | — | **68** | Modal de confirmação com motivo de anulação de guia de stock |
| `utils/stockTransferState.ts` | — | **53** | Funções puras de state machine, projeção de stock e exportação CSV |
| `components/TransferStatusBadge.tsx` | — | **40** | Badge reutilizável de estados de transferência |
| `types/stock-transfer.types.ts` | — | **24** | Definições de tipos e interfaces estritas do módulo |

---

## 3. MATRIZ DE RESPONSABILIDADES

| Responsabilidade | Localização Antes | Localização Depois | Backend Contract / RPC |
| :--- | :--- | :--- | :--- |
| **Seleção de Modo** | `StockMovementsPage.tsx` | `components/StockModeSelector.tsx` | Estado React puro |
| **Entrada Direta (Draft/Submit)** | `StockMovementsPage.tsx` | `hooks/useDirectStockMovement.ts` + `DirectMovementSection.tsx` | `create_stock_guide_v2` / `update_stock_guide_v2` |
| **Saída Direta (Draft/Submit)** | `StockMovementsPage.tsx` | `hooks/useDirectStockMovement.ts` + `DirectMovementSection.tsx` | `create_stock_guide_v2` / `update_stock_guide_v2` |
| **Criação de Transferência** | `StockMovementsPage.tsx` | `hooks/useStockTransfersManagement.ts` + `StockTransferSection.tsx` | `create_stock_transfer_v1` |
| **Expedição de Transferência** | `StockMovementsPage.tsx` | `hooks/useStockTransfersManagement.ts` + `TransferHistorySection.tsx` | `dispatch_stock_transfer_v1` |
| **Recepção de Transferência** | `StockMovementsPage.tsx` | `hooks/useStockTransfersManagement.ts` + `TransferHistorySection.tsx` | `receive_stock_transfer_v1` |
| **Anulação de Transferência** | `StockMovementsPage.tsx` | `hooks/useStockTransfersManagement.ts` + `TransferHistorySection.tsx` | `cancel_stock_transfer_v1` |
| **Anulação de Guia de Stock** | `StockMovementsPage.tsx` | `components/CancelGuideModal.tsx` | `cancel_stock_guide_v2` |
| **Histórico de Movimentos** | `StockMovementsPage.tsx` | `hooks/useStockMovementHistory.ts` + `MovementHistorySection.tsx` | `get_stock_movements_page_v2` |
| **Extrato do Artigo** | `StockMovementsPage.tsx` | `ArticleLedgerModal.tsx` | `get_product_movements_extract_v1` |
| **Filtros e Paginação** | `StockMovementsPage.tsx` | `hooks/useStockMovementHistory.ts` | Server-side query com debounce |

---

## 4. MATRIZ DE RPCs E CONTRATOS BACKEND

| RPC / Operação | Read/Write | Atómica? | Locks? | Idempotência? | Verificação de Permissão? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `create_stock_guide_v2` | WRITE | SIM | SIM (`FOR UPDATE`) | SIM (`p_idempotency_key`) | SIM (Tenant & RLS) |
| `update_stock_guide_v2` | WRITE | SIM | SIM (`FOR UPDATE`) | SIM | SIM (Tenant & RLS) |
| `cancel_stock_guide_v2` | WRITE | SIM | SIM (`FOR UPDATE`) | SIM (`p_idempotency_key`) | SIM (Tenant & RLS) |
| `create_stock_transfer_v1` | WRITE | SIM | SIM | SIM | SIM (Tenant & RLS) |
| `dispatch_stock_transfer_v1` | WRITE | SIM | SIM (`FOR UPDATE`) | SIM | SIM (Tenant & RLS) |
| `receive_stock_transfer_v1` | WRITE | SIM | SIM (`FOR UPDATE`) | SIM | SIM (Tenant & RLS) |
| `cancel_stock_transfer_v1` | WRITE | SIM | SIM (`FOR UPDATE`) | SIM | SIM (Tenant & RLS) |
| `get_stock_movements_page_v2` | READ | N/A | NÃO | N/A | SIM (Tenant Isolation) |
| `get_product_movements_extract_v1`| READ | N/A | NÃO | N/A | SIM (Tenant Isolation) |

---

## 5. STATE MACHINE DE TRANSFERÊNCIAS DE STOCK

```
        ┌──────────────┐
        │    DRAFT     │
        │  (PENDING)   │
        └──────┬───────┘
               │
       Dispatch│ (Origem -Q)
               ▼
        ┌──────────────┐
        │  IN_TRANSIT  │─────────┐ Cancel (Origem +Q)
        │ (DISPATCHED) │         │
        └──────┬───────┘         ▼
               │          ┌──────────────┐
        Receive│ (Dest +Q)│  CANCELLED   │
               ▼          └──────────────┘
        ┌──────────────┐
        │   RECEIVED   │ (Final)
        └──────────────┘
```

| Estado Inicial | Ação | Estado Final | Permitido? | Efeito no Stock de Origem | Efeito no Stock de Destino |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `DRAFT` / `PENDING` | `dispatch` | `IN_TRANSIT` | **SIM** | **-Q** | **0** |
| `DRAFT` / `PENDING` | `cancel` | `CANCELLED` | **SIM** | **0** | **0** |
| `IN_TRANSIT` | `receive` | `RECEIVED` | **SIM** | **0** | **+Q** |
| `IN_TRANSIT` | `cancel` | `CANCELLED` | **SIM** | **+Q** (Reversão) | **0** |
| `RECEIVED` | `receive` | — | **NÃO** | Rejeitado (409 Conflict) | Rejeitado |
| `RECEIVED` | `cancel` | — | **NÃO** | Rejeitado (Estado final) | Rejeitado |

---

## 6. MATRIZ DE PERMISSÕES OPERACIONAIS

| Ação Operacional | Guard de Frontend | Autoridade de Segurança Backend |
| :--- | :--- | :--- |
| **Entrada Direta** | `canPostEntry` | RLS + RPC `create_stock_guide_v2` |
| **Saída Direta** | `canPostExit` | RLS + RPC `create_stock_guide_v2` |
| **Transferência entre Armazéns** | `canTransfer` | RLS + RPC `create_stock_transfer_v1` |
| **Anulação de Guia** | `canCancelGuide` | RLS + RPC `cancel_stock_guide_v2` |
| **Visualização de Preço de Custo** | `canViewCost` | Column level security / Sanitized projection |
| **Stock Negativo** | `canAllowNegative` | Backend constraint / RPC stock balance check |

---

## 7. MATRIZ DE EVIDÊNCIA DE TESTES E PRODUÇÃO

| Comportamento / Fluxo | Código de Produção Exercitado? | Tipo de Evidência | Ficheiro / Suite de Teste | Resultado |
| :--- | :---: | :--- | :--- | :--- |
| **State Machine: Dispatch** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **State Machine: Receive** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **State Machine: Cancel** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Projeção de Stock (Entrada/Saída)** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Cálculo de Crédito a Fornecedor**| **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Exportação CSV UTF-8 BOM** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Validação Armazém Origem != Destino**| **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Validação Linhas Obrigatórias** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Renderização do Workspace de Entrada**| **SIM** | `COMPONENT_TESTED` | `tests/unit/stockMovementsRender.test.ts` | `PASS` |
| **Guards de Permissão em Renderização**| **SIM** | `COMPONENT_TESTED` | `tests/unit/stockMovementsRender.test.ts` | `PASS` |
| **Paginação Server-Side de Movimentos**| **SIM** | `UNIT_TESTED` | `tests/unit/pagination.test.ts` | `PASS` |

---

## 8. EVIDÊNCIA DE INTEGRIDADE AUTOMATIZADA

- **Testes Automatizados (Vitest):** `15/15` suites, **70/70 testes aprovados (100% PASS)** em ~1.45s.
- **`npm run check`:**
  - Auditoria de segurança de credenciais: **PASS** (0 chaves/segredos).
  - Auditoria de integridade multiempresa / dados estáticos: **PASS** (Branding neutro).
  - Contrato de rollback da migração 016: **PASS**.
  - Compilação TypeScript (`tsc`): **PASS** (0 erros).
  - Vite production build: **PASS** (`dist/` gerado com sucesso em ~14.8s).
- **UI Freeze:** **100% preservado** (`VISUAL_CHANGES = NONE`).
- **Database Schema:** **100% inalterado** (`DATABASE_SCHEMA_CHANGED = NO` | `MIGRATIONS_ADDED = 0`).
- **Visual Review:** `CURRENT_UI_MANUAL_REVIEW = PASS` | `VISUAL_PARITY_WITH_PRE_PHASE_SCREENSHOT = NOT_VERIFIED`.

---

## 9. DECISÃO FINAL DO GATE

```ini
PHASE_04_STATUS = PASS
READY_FOR_PHASE_05 = YES
```
