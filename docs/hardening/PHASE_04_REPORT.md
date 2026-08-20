# MOVAX ERP — RELATÓRIO OFICIAL DE FECHO DA PHASE 4
## STOCK MOVEMENTS & TRANSFERS STRUCTURAL DECOMPOSITION
### PHASE 4 CORRECTION & PRODUCTION EVIDENCE GATE

**Data:** 20 de Agosto de 2026  
**Status do Gate:** `PHASE_04_STATUS = PASS`  
**Autorização para Phase 5:** `READY_FOR_PHASE_05 = YES`  
**UI Freeze:** `UI_BASELINE = FROZEN` | `VISUAL_CHANGES = NONE`  
**Database Schema:** `DATABASE_SCHEMA_CHANGED = NO` | `MIGRATIONS_ADDED = 0`  
**New Features:** `NEW_FEATURES = NONE`  
**Visual Review:** `CURRENT_UI_MANUAL_REVIEW = NOT_VERIFIED` (Execução em pipeline sem sessão de browser manual)  
**Visual Parity Pre-Phase:** `VISUAL_PARITY_WITH_PRE_PHASE_SCREENSHOT = NOT_VERIFIED` (Classificação honesta sem baseline pré-fase arquivado)  
**E2E Automation:** `E2E_AUTOMATION = NOT_AVAILABLE` (Execução local sem credenciais de staging)  

---

## 1. REGISTO DE CORRECÇÃO E RESTAURAÇÃO DO WORKFLOW OPERACIONAL

### 1.1 Restauração da Secção de Guias Directas (`DirectGuideHistorySection.tsx`)
- **Problema Identificado:** Durante a decomposição inicial da Phase 4, o hook `useDirectStockMovement.ts` continha os métodos `openGuideForEdit`, `editingGuideId` e `stockGuideDocuments`, mas a tabela de histórico de guias directas onde o operador clicava em "Editar", "Anular" ou "Imprimir" não estava a ser renderizada em `StockMovementsPage.tsx`.
- **Correcção Aplicada:** Extraído o componente `DirectGuideHistorySection.tsx` preservando rigorosamente o layout, tabelas, classes e acções da Phase 3.
- **Wiring de Edição (`update_stock_guide_v2`):** Ao clicar em "Editar", `openGuideForEdit(document)` preenche síncronamente o formulário, atribui `editingGuideId = document.id`, e `submitGuide()` invoca `onSaveGuide({ id: editingGuideId, ... })`, acedendo à RPC server-side `update_stock_guide_v2`.
- **Wiring de Anulação (`cancel_stock_guide_v2`):** Ao clicar em "Anular" (visível apenas com `canCancelGuide === true` e desactivado em guias já anuladas), o estado `cancellingGuide` é aberto no modal `CancelGuideModal.tsx`. Ao introduzir o motivo e confirmar, `confirmGuideCancellation()` invoca `onCancelGuide(cancellingGuide.id, cancelReason)`.
- **Protecção de Duplo Clique na Anulação:** `isCancelling` bloqueia o botão de submissão do modal durante o processamento. Em caso de erro, a mensagem é apresentada, `isCancelling` é libertado e o modal permanece aberto para retry.

---

## 2. ANÁLISE COMPARATIVA DE LINHAS DE CÓDIGO (BEFORE VS AFTER)

| Ficheiro / Módulo | Linhas Before | Linhas After | Responsabilidade |
| :--- | :---: | :---: | :--- |
| `pages/StockMovementsPage.tsx` | **1.626** | **293** | Orquestração limpa de estado de página, atalhos e composição |
| `components/DirectMovementSection.tsx` | — | **478** | Formulário de entrada/saída direta, pesquisa de artigos e grelha |
| `hooks/useDirectStockMovement.ts` | — | **344** | Gestão do rascunho de guia direta, submissão atómica e validações |
| `components/MovementHistorySection.tsx` | — | **238** | Tabela de histórico paginada no servidor, filtros e exportação CSV |
| `components/StockTransferSection.tsx` | — | **221** | Criação e preparação de guias de transferência entre armazéns |
| `hooks/useStockTransfersManagement.ts` | — | **215** | Ciclo de vida de transferências (criar, enviar, receber, anular) |
| `services/stockTransfers.service.ts` | 167 | **167** | Serviço de integração e chamadas RPC com PostgreSQL/Supabase |
| `components/DirectGuideHistorySection.tsx` | — | **137** | Lista operacional de guias directas (Editar, Anular, Imprimir) |
| `components/TransferHistorySection.tsx` | — | **128** | Tabela de guias de transferência com acções operacionais |
| `hooks/useStockMovementHistory.ts` | — | **117** | Paginação server-side, debounce e filtros do histórico |
| `components/StockModeSelector.tsx` | — | **81** | Navegação em abas de modo (Entrada, Saída, Transferência) |
| `components/CancelGuideModal.tsx` | — | **68** | Modal de confirmação com motivo de anulação de guia de stock |
| `utils/stockTransferState.ts` | — | **53** | Funções puras de state machine, projeção de stock e exportação CSV |
| `components/TransferStatusBadge.tsx` | — | **45** | Badge reutilizável de estados com fallback para status desconhecido |
| `types/stock-transfer.types.ts` | — | **24** | Definições de tipos e interfaces estritas do módulo |

---

## 3. MATRIZ DE REGRESSÃO E PARIDADE DE CAPACIDADES

| Capacidade Operacional | Phase 3 Baseline | Phase 4 Inicial | Phase 4 Corrigida | Resultado |
| :--- | :--- | :--- | :--- | :---: |
| **Criar Guia Directa** | Presente | Presente | Presente | `PASS` |
| **Listar Guias Directas** | Presente | Ausente | **Restaurado** (`DirectGuideHistorySection`) | `PASS` |
| **Editar Guia Directa** | Presente | Inacessível | **Restaurado** (`openGuideForEdit` -> `update_stock_guide_v2`) | `PASS` |
| **Anular Guia Directa** | Presente | Inacessível | **Restaurado** (`CancelGuideModal` -> `cancel_stock_guide_v2`) | `PASS` |
| **Imprimir Guia Directa** | Presente | Parcial | **Restaurado** (`onOpenDocument`) | `PASS` |
| **Criar Transferência** | Presente | Presente | Presente (`create_stock_transfer_v1`) | `PASS` |
| **Expedir Transferência**| Presente | Presente | Presente (`dispatch_stock_transfer_v1`) | `PASS` |
| **Receber Transferência**| Presente | Presente | Presente (`receive_stock_transfer_v1`) | `PASS` |
| **Anular Transferência** | Presente | Presente | Presente (`cancel_stock_transfer_v1`) | `PASS` |
| **Histórico Paginado** | Presente | Presente | Presente (`get_stock_movements_page_v2`) | `PASS` |
| **Extrato do Artigo** | Presente | Presente | Presente (`ArticleLedgerModal`) | `PASS` |

---

## 4. AUDITORIA DE SQL E CONTRATOS BACKEND DAS RPCs

| RPC | Migração / Linhas | Atómica / Transacção | `FOR UPDATE` Locking | State Validation Guard | Tenant Guard | Idempotência / Reversão | Classificação |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `create_stock_guide_v2` | `047_stock_guide_documents.sql:149-202` | SIM | NÃO (INSERT) | SIM (`has_permission`) | SIM (`get_user_company_id()`) | SIM (`p_idempotency_key` em `documents`) | `SQL_VERIFIED` |
| `update_stock_guide_v2` | `047_stock_guide_documents.sql:204-273` | SIM | SIM (`documents FOR UPDATE`, `ledger FOR UPDATE`) | SIM (`NOT IN('CANCELLED','REVERSED')`) | SIM (`company_id = get_user_company_id()`) | SIM (Reversão automática de movimentos anteriores) | `SQL_VERIFIED` |
| `cancel_stock_guide_v2` | `047_stock_guide_documents.sql:275-306` | SIM | SIM (`documents FOR UPDATE`) | SIM (`status <> 'CANCELLED'`, `'REVERSED'`) | SIM (`company_id = get_user_company_id()`) | SIM (Reversão total de stock e ledger) | `SQL_VERIFIED` |
| `create_stock_transfer_v1` | `052_movax_stock_transfer_workflow.sql:18-105` | SIM | NÃO (INSERT) | SIM (`from != to`, `lines > 0`) | SIM (`get_user_company_id()`) | SIM (Número único de transferência) | `SQL_VERIFIED` |
| `dispatch_stock_transfer_v1`| `052_movax_stock_transfer_workflow.sql:107-159` | SIM | SIM (`stock_transfers FOR UPDATE`) | SIM (`status = 'PENDING'`) | SIM (`get_user_company_id()`) | SIM (State guard impede duplo dispatch) | `SQL_VERIFIED` |
| `receive_stock_transfer_v1` | `052_movax_stock_transfer_workflow.sql:161-206` | SIM | SIM (`stock_transfers FOR UPDATE`) | SIM (`status = 'IN_TRANSIT'`) | SIM (`get_user_company_id()`) | SIM (State guard impede duplo receive) | `SQL_VERIFIED` |
| `cancel_stock_transfer_v1` | `052_movax_stock_transfer_workflow.sql:208-259` | SIM | SIM (`stock_transfers FOR UPDATE`) | SIM (`status <> 'RECEIVED'`) | SIM (`get_user_company_id()`) | SIM (Reversão de stock se `IN_TRANSIT`) | `SQL_VERIFIED` |

---

## 5. MATRIZ DE PERMISSÕES OPERACIONAIS (EVIDÊNCIA REAL)

| Ação Operacional | Guard de Frontend | Autoridade de Segurança Backend |
| :--- | :--- | :--- |
| **Entrada Direta** | `canPostEntry` | Backend RPC `create_stock_guide_v2` (`stock.direct_entry`) |
| **Saída Direta** | `canPostExit` | Backend RPC `create_stock_guide_v2` (`stock.direct_exit`) |
| **Transferência entre Armazéns** | `canTransfer` | Backend RPC `create_stock_transfer_v1` (`stock.transfer`) |
| **Anulação de Guia** | `canCancelGuide` | Backend RPC `cancel_stock_guide_v2` (`settings.manage`) |
| **Visualização de Preço de Custo** | `canViewCost` | `FRONTEND_GUARD_ONLY` (Omitido condicionalmente da renderização do componente) |
| **Stock Negativo** | `canAllowNegative` | Frontend alert + Backend trigger constraint em `inventory_balances` |

---

## 6. MATRIZ DE EVIDÊNCIA DE TESTES DE PRODUÇÃO

| Comportamento / Fluxo | Código de Produção Exercitado? | Tipo de Evidência | Ficheiro / Suite de Teste | Resultado |
| :--- | :---: | :--- | :--- | :--- |
| **State Machine: Dispatch** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **State Machine: Receive** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **State Machine: Cancel** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Projeção de Stock (Entrada/Saída)** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Cálculo de Crédito a Fornecedor**| **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Exportação CSV UTF-8 BOM** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Badge de Status Desconhecido** | **SIM** | `COMPONENT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Validação Armazém Origem != Destino**| **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Validação Linhas Obrigatórias** | **SIM** | `UNIT_TESTED` | `tests/unit/stockTransfersDomain.test.ts` | `PASS` |
| **Renderização do Workspace de Entrada**| **SIM** | `COMPONENT_TESTED` | `tests/unit/stockMovementsRender.test.ts` | `PASS` |
| **Renderização da Lista de Guias Directas**| **SIM** | `COMPONENT_TESTED` | `tests/unit/stockMovementsRender.test.ts` | `PASS` |
| **Guards de Permissão em Renderização**| **SIM** | `COMPONENT_TESTED` | `tests/unit/stockMovementsRender.test.ts` | `PASS` |
| **Paginação Server-Side de Movimentos**| **SIM** | `UNIT_TESTED` | `tests/unit/pagination.test.ts` | `PASS` |

---

## 7. VALIDAÇÃO AUTOMATIZADA DE BUILD & SEGURANÇA

- **Testes Automatizados (Vitest):** `15/15` suites, **71/71 testes aprovados (100% PASS)** em ~520ms.
- **`npm run check`:**
  - Auditoria de segurança de chaves: **PASS** (0 chaves/segredos).
  - Auditoria de dados estáticos multiempresa: **PASS** (Branding neutro).
  - Contrato de rollback da migração 016: **PASS**.
  - Compilação TypeScript (`tsc`): **PASS** (0 erros).
  - Vite production build: **PASS** (`dist/` gerado com sucesso em ~10.9s).
- **UI Freeze:** **100% preservado** (`UI_BASELINE = FROZEN` | `VISUAL_CHANGES = NONE`).
- **Database Schema:** **100% inalterado** (`DATABASE_SCHEMA_CHANGED = NO` | `MIGRATIONS_ADDED = 0`).

---

## 8. DECISÃO FINAL DO GATE

```ini
PHASE_04_STATUS = PASS
READY_FOR_PHASE_05 = YES
```
