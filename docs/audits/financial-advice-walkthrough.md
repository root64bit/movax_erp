# AUDITORIA FINAL DE SEGURANÇA, RECALCULO E CANCELAMENTO NA INTERFACE
## MÓDULO: AVISOS DE CRÉDITO (CLIENTES E FORNECEDORES)
### Plataforma Casa de Pneus — 31/07/2026

---

## 1. Confirmação da Migração 028 e Reforço da Migração 029

- **Migração `028`**: 100% Intacta (`git status` limpo). Nenhuma migração aplicada anteriormente foi alterada.
- **Reforço na Migração `20260731190000_029_secure_financial_advice_cancellation.sql`**:
  1. **Função Central de Recálculo Financeiro (`public.recalculate_document_financial_state`)**:
     - Separa o valor pago em dinheiro (`amount_paid`) das atribuições de crédito activas (`financial_advice_allocations`).
     - Recalcula o saldo pendente: `grand_total - (amount_paid + active_credits)`.
     - Recalcula o estado do documento (`CONFIRMED`, `PARTIALLY_PAID`, `PAID`) de forma consistente sem mascarar inconsistências com `GREATEST`.
  2. **Idempotência Estrita Multi-Tenant**:
     - `p_idempotency_key UUID` obrigatório.
     - Restrição de unicidade por empresa e chave: `CONSTRAINT uq_cancellation_tenant_idempotency UNIQUE (company_id, idempotency_key)`.
     - Rejeita explicitamente reuso de chave entre documentos diferentes com a excepção `IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_DOCUMENT`.
  3. **RPC de Compras de Fornecedores (`get_supplier_total_purchases_summary`)**:
     - Agrega o total histórico de compras no banco de dados filtrando por `SUPPLIER_INVOICE` em estado `CONFIRMED`, `PARTIALLY_PAID` ou `PAID`.
     - Consumido no frontend em `loadAppData()` mapeando `totalPurchases` por `supplier_id`.

---

## 2. Integração do Fluxo de Cancelamento na Interface (`src/pages/Documents.tsx`)

1. **Botão de Cancelamento de Avisos**:
   - Disponível no ecrã de **Pesquisa de Documentos** apenas para avisos financeiros em estado `CONFIRMED` e para utilizadores com a permissão `financial_adjustments.cancel`.
2. **Modal com Motivo Obrigatório & Chave de Idempotência UUID**:
   - Exige o preenchimento de um motivo válido de cancelamento.
   - Gera um UUID único (`crypto.randomUUID()`) por tentativa no frontend para garantir idempotência.
3. **Reconciliação e Estado na Tela**:
   - Executa a reversão via RPC `cancel_financial_advice`.
   - Recarrega os dados e actualiza instantaneamente o estado visual para `CANCELLED` com badge vermelha de destaque.

---

## 3. Resultado da Compilação e Build Local

- **TypeScript (`npx tsc --noEmit`)**: **0 erros**.
- **Build Local (`npm run build`)**: Vite production bundle construído com **100% de Sucesso**.
- **Isolamento de Produção**: Todas as alterações permanecem no repositório local.
