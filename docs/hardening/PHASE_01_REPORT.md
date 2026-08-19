# MOVAX ERP — RELATÓRIO DE HARDENING: FASE 1 (CORRECTION GATE CONCLUÍDO)

**Data:** 19 de Agosto de 2026  
**Objectivo:** Desacoplar `src/lib/appData.ts`, eliminar `loadAppData('all')` do runtime, consolidar os serviços de domínio, assegurar RBAC de utilizadores, segurança atómica no cancelamento de transferências de stock e correcção fiscal de IVA 0%.  
**Estado:** `PHASE_01_STATUS = PASS`  
**Autorização para Fase 2:** `READY_FOR_PHASE_02 = YES`

---

## 1. UI Freeze & Regras de Conformidade

- **UI Freeze:** `VISUAL_CHANGES = NONE` (Zero alterações visuais no POS, Sidebar, Header, Modais, Tabelas e Formulários).
- **Sem Big-Bang Rewrite:** As interfaces e componentes consumidos pelas páginas operacionais mantêm compatibilidade estrita.

---

## 2. Eliminação do Monólito AppData & Evidência de Desacoplamento

### Auditoria de Código Real (`scripts/audit_appdata.cjs`):

| Métrica | Antes da Fase 1 | Após a Fase 1 (Correction Gate) |
| :--- | :--- | :--- |
| **Linhas de código em `appData.ts`** | 2.150 linhas | 2.150 linhas (funções legadas encapsuladas como delegators) |
| **Chamadas a `loadAppData('all')` no runtime** | **18 chamadas** | **0 chamadas** (`loadAppData('all')` totalmente erradicado) |
| **Ficheiros que importam `appData`** | 18 ficheiros | **1 único ficheiro** (`PrivateRoutes.tsx`) |
| **Estratégia de carregamento de dados** | Monolítica no Login (todos os artigos, docs, clientes, movimentos, pagamentos) | **Scoped Lazy Loading** (apenas metadados e fatias de domínio sob demanda) |
| **Serviços de Domínio Especializados** | 0 serviços estruturados | **10 serviços dedicados** em `src/features/*/services/` |

---

## 3. Matriz de Correções do Correction Gate

### A. RBAC & Gestão de Utilizadores (`AdministrationService`)
- [x] **`createUser`**: Preservada a criação via RPC administrativa com atribuição de tenant e sincronização de múltiplos pacotes em `user_roles`.
- [x] **`updateUser`**: Preservada a atualização de `is_active`, pacotes de responsabilidades (`newBundles`), permissões e password com segurança.
- [x] **Segurança:** Zero armazenamento de passwords em tabelas públicas e zero vazamento de service-role key no frontend.

### B. Cancelamento Transacional de Transferências de Stock (`StockTransfersService`)
- [x] **Segurança de Stock:** Eliminado qualquer update directo inseguro em `stock_transfers`.
- [x] **RPC `cancel_stock_transfer_v1`:**
  - `PENDING` (Rascunho): cancela sem alterar stock físico.
  - `IN_TRANSIT`: executa reversão atómica de stock para o armazém de origem via `post_stock_movement('reversal')`.
  - `RECEIVED`: rejeita formalmente o cancelamento (`RECEIVED_TRANSFER_CANNOT_BE_CANCELLED`).

### C. Correção Fiscal de IVA 0% (Isenção / ISE)
- [x] **Eliminação de `|| 16`:** Substituído por verificação numérica estrita `item.ivaPercent !== undefined && item.ivaPercent !== null ? Number(item.ivaPercent) : 16`.
- [x] **Compatibilidade:** 16% (Normal), 0% (Isento), 5% (Reduzido) e descontos sobre artigos isentos calculados sem incidência acidental de IVA.

---

## 4. Testes Unitários e Validação Automatizada

### Execução Vitest (`npx vitest run`):
```text
 ✓ tests/unit/stockCalculations.test.ts (9 tests)
 ✓ tests/unit/administration.test.ts (6 tests)
 ✓ tests/unit/cashCalculations.test.ts (2 tests)
 ✓ tests/unit/posCalculations.test.ts (8 tests)
 ✓ tests/unit/entitlements.test.ts (4 tests)

 Test Files: 5 passed (5)
      Tests: 29 passed (29) — 100% de sucesso
```

### Execução de Verificação (`npm run check`):
- `audit:security`: PASS (zero chaves de API ou segredos no repositório)
- `audit:static-data`: PASS (branding multiempresa neutro)
- `validate_migration_016_rollback`: PASS
- `tsc` (TypeScript Compiler): PASS (0 erros)
- `vite build`: PASS (compilação estática bem-sucedida em 7.81s)

---

## 5. Decisão Final do Gate

```text
PHASE_01_STATUS = PASS

READY_FOR_PHASE_02 = YES
```
