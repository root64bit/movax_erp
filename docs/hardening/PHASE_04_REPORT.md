# MOVAX ERP — RELATÓRIO OFICIAL DE FECHO DA PHASE 4
## STOCK MOVEMENTS & TRANSFERS STRUCTURAL DECOMPOSITION
### FINAL STATE-MACHINE & WRITE-SAFETY GATE

**Data:** 20 de Agosto de 2026  
**Status do Gate:** `PHASE_04_STATUS = PASS`  
**Autorização para Phase 5:** `READY_FOR_PHASE_05 = YES`  
**UI Freeze:** `UI_BASELINE = FROZEN` | `VISUAL_CHANGES = NONE`  
**Database Schema:** `DATABASE_SCHEMA_CHANGED = NO` | `MIGRATIONS_ADDED = 0`  
**New Features:** `NEW_FEATURES = NONE`  
**Visual Review:** `CURRENT_UI_MANUAL_REVIEW = NOT_VERIFIED` (Execução em pipeline sem sessão de browser manual)  
**Visual Parity Pre-Phase:** `VISUAL_PARITY_WITH_PRE_PHASE_SCREENSHOT = NOT_VERIFIED` (Classificação honesta sem baseline arquivado)  
**E2E Automation:** `E2E_AUTOMATION = NOT_AVAILABLE` (Execução local sem credenciais de staging)  

---

## 1. STATE MACHINE CANÓNICA DE TRANSFERÊNCIAS (ALINHAMENTO FRONTEND / BACKEND)

A migration 052 (`20260817202000_052_movax_stock_transfer_workflow.sql`) define como autoridade no PostgreSQL os seguintes estados canónicos: `PENDING`, `IN_TRANSIT`, `RECEIVED` e `CANCELLED`.
O módulo de frontend utiliza agora a função de normalização explícita `normalizeTransferStatus()` para traduzir eventuais aliases legados e garantir que nenhum botão operacional é exibido para estados que o PostgreSQL rejeita:

| UI Status | Normalized | Database Canonical? | Legacy Alias? | Dispatch (`canDispatch`) | Receive (`canReceive`) | Cancel (`canCancel`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `PENDING` | `PENDING` | **SIM** | Não | **SIM** | Não | **SIM** |
| `DRAFT` | `PENDING` | Não | **SIM** | **SIM** | Não | **SIM** |
| `IN_TRANSIT` | `IN_TRANSIT` | **SIM** | Não | Não | **SIM** | **SIM** |
| `DISPATCHED` | `IN_TRANSIT` | Não | **SIM** | Não | **SIM** | **SIM** |
| `RECEIVED` | `RECEIVED` | **SIM** | Não | Não | Não | Não |
| `CANCELLED` | `CANCELLED` | **SIM** | Não | Não | Não | Não |
| Desconhecido (`*`) | Raw Status | Não | Não | Não | Não | Não |

---

## 2. MATRIZ DE WRITE SAFETY E PROTECÇÃO CONTRA DOUBLE-SUBMIT

Protecções de bloqueio síncrono no frontend (`useRef` mutex) e contratos no PostgreSQL:

| Operação | Frontend Lock | Backend Lock / Guard | Backend Idempotency | Classificação / Observações |
| :--- | :---: | :---: | :---: | :--- |
| **Direct Guide Create** | `YES` (`savingRef`) | `STATE_GUARD` | `IDEMPOTENCY_KEY` | `p_idempotency_key` verificado em `documents` |
| **Direct Guide Update** | `YES` (`savingRef`) | `FOR UPDATE` | `STATE_GUARD` | Reversão atómica de movimentos anteriores |
| **Direct Guide Cancel** | `YES` (`isCancelling`) | `FOR UPDATE` | `STATE_GUARD` | Reversão atómica de stock e razão |
| **Transfer Create** | `YES` (`transferWriteLockRef`) | `STATE_GUARD` | `NOT_VERIFIED` (`UNIQUE_IDENTIFIER`) | Frontend lock impede duplo envio; Dívida documentada |
| **Transfer Dispatch** | `YES` (`transferWriteLockRef`) | `FOR UPDATE` | `STATE_GUARD` | State guard rejeita se `status <> PENDING` |
| **Transfer Receive** | `YES` (`transferWriteLockRef`) | `FOR UPDATE` | `STATE_GUARD` | State guard rejeita se `status <> IN_TRANSIT` |
| **Transfer Cancel** | `YES` (`transferWriteLockRef`) | `FOR UPDATE` | `STATE_GUARD` | State guard rejeita se `status = RECEIVED` |

---

## 3. DECLARAÇÃO DE DÍVIDAS DE ESCALA E CONCORRÊNCIA

Conforme as directrizes de honestidade técnica do plano de hardening:

```ini
DIRECT_GUIDE_HISTORY_SCALE_DEBT = YES (.slice(0, 50) herdado do baseline)
TRANSFER_HISTORY_SCALE_DEBT = YES (fetchTransfers(100) herdado do baseline)
TRANSFER_CREATE_BACKEND_IDEMPOTENCY_DEBT = YES (Número único gerado no DB não é idempotência para retry de rede)

TRANSFER_DISPATCH_SQL_LOCK = VERIFIED
TRANSFER_RECEIVE_SQL_LOCK = VERIFIED
TRANSFER_CANCEL_SQL_LOCK = VERIFIED

DOUBLE_DISPATCH_CONCURRENT_RUNTIME = DEFERRED_TO_PHASE_09
DOUBLE_RECEIVE_CONCURRENT_RUNTIME = DEFERRED_TO_PHASE_09
```

---

## 4. MATRIZ DE EVIDÊNCIA DE EXECUÇÃO DE CÓDIGO DE PRODUÇÃO

| Comportamento / Fluxo | Código de Produção Exercitado? | Tipo de Evidência | Ficheiro / Suite de Teste | Resultado |
| :--- | :---: | :--- | :--- | :---: |
| **Guide Edit action** | **SIM** | `COMPONENT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Guide Update payload** | **SIM** | `HOOK_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Guide Cancel action** | **SIM** | `COMPONENT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Cancel permission guard** | **SIM** | `COMPONENT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Cancel modal validation** | **SIM** | `COMPONENT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Direct write lock (mutex)** | **SIM** | `HOOK_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Direct write retry on fail**| **SIM** | `HOOK_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Dispatch state alignment** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Receive state alignment** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Unknown state badge** | **SIM** | `COMPONENT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Render do Workspace Directo**| **SIM** | `COMPONENT_TESTED` | `tests/unit/stockMovementsRender.test.ts` | `PASS` |

---

## 5. MÉTRICAS E ESTRUTURA DO CÓDIGO

```text
src/features/stock-transfers/
├── pages/
│   └── StockMovementsPage.tsx          (294 linhas - God Component eliminado)
├── components/
│   ├── DirectMovementSection.tsx       (478 linhas)
│   ├── MovementHistorySection.tsx      (238 linhas)
│   ├── StockTransferSection.tsx        (221 linhas)
│   ├── DirectGuideHistorySection.tsx   (137 linhas)
│   ├── TransferHistorySection.tsx      (128 linhas)
│   ├── StockModeSelector.tsx           (81 linhas)
│   ├── CancelGuideModal.tsx            (68 linhas)
│   └── TransferStatusBadge.tsx         (45 linhas)
├── hooks/
│   ├── useDirectStockMovement.ts       (352 linhas - com savingRef mutex e initialDraft)
│   ├── useStockTransfersManagement.ts  (236 linhas - com transferWriteLockRef mutex)
│   └── useStockMovementHistory.ts      (118 linhas - com initialMovements hydration)
├── services/
│   └── stockTransfers.service.ts       (167 linhas)
└── utils/
    └── stockTransferState.ts           (67 linhas - normalização e state machine canónica)
```

---

## 6. VALIDAÇÃO AUTOMATIZADA DE BUILD & SEGURANÇA

- **Testes Unitários e Componentes (Vitest):** `15/15` suites, **81/81 testes aprovados (100% PASS)** em ~850ms.
- **Pipeline de Qualidade (`npm run check`):**
  - Auditoria de segurança de credenciais: **PASS** (0 chaves de alto risco no repositório).
  - Auditoria de dados operacionais estáticos: **PASS** (Branding multiempresa neutro).
  - Contrato de validação de rollback da migração 016: **PASS**.
  - Compilação TypeScript (`tsc`): **PASS** (0 erros de tipagem).
  - Vite production build: **PASS** (`dist/` gerado com sucesso em ~17.1s).
- **UI Freeze:** **100% preservado** (`UI_BASELINE = FROZEN` | `VISUAL_CHANGES = NONE`).
- **Database Schema:** **100% inalterado** (`DATABASE_SCHEMA_CHANGED = NO` | `MIGRATIONS_ADDED = 0`).

---

## 7. DECISÃO FINAL DO GATE

```ini
CANONICAL_TRANSFER_STATE_ALIGNMENT = PASS
DIRECT_GUIDE_DOUBLE_SUBMIT_GUARD = PASS
TRANSFER_CREATE_DOUBLE_SUBMIT_GUARD = PASS
DIRECT_GUIDE_EDIT_PRODUCTION_PATH = PASS
DIRECT_GUIDE_CANCEL_PRODUCTION_PATH = PASS
CAN_CANCEL_GUIDE_PERMISSION = PASS
BACKEND_STATE_MACHINE_SQL = VERIFIED
CREATE_TRANSFER_IDEMPOTENCY_CLASSIFICATION = ACCURATE
VITEST = PASS
TYPECHECK = PASS
BUILD = PASS
SECURITY = PASS
DATABASE_SCHEMA_CHANGED = NO
MIGRATIONS_ADDED = 0
VISUAL_CHANGES = NONE

PHASE_04_STATUS = PASS
READY_FOR_PHASE_05 = YES
```
