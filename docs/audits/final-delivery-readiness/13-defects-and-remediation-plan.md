# Defeitos Encontrados e Plano de Remediação

## 1. Registo de Defeitos e Vulnerabilidades

### Defeito D-01: Inserção Direta na Tabela `document_lines` em `createQuotation`
- **Severidade**: `MÉDIO` (Não afeta segurança nem abate stock, mas violou regra estática de auditoria)
- **Componente**: `src/lib/appData.ts:374`
- **Descrição**: A função `createQuotation` emite cotações inserindo diretamente em `documents` e `document_lines` para não acionar abate de stock de vendas normais. O script de auditoria estática `audit-static-operational-data.js` sinaliza inserções diretas em tabelas de documentos.
- **Remediação Recomendada**: Encapsular a criação de cotações num RPC PostgreSQL dedicado `create_customer_quotation` com `0` abate de stock para manter conformidade a 100% com o linter estático.
- **Esforço Estimado**: 2 Horas.

---

## 2. Plano de Remediação Priorizado

1. **Prioridade 1 (Piloto)**: Iniciar o piloto de 14 dias com a versão estável atual em [https://casadepeneus-seven.vercel.app](https://casadepeneus-seven.vercel.app).
2. **Prioridade 2 (Refatoração)**: Substituir a inserção direta de cotações por um RPC `create_customer_quotation` em `appData.ts`.
3. **Prioridade 3 (Migração Legada)**: Reconciliar e importar o catálogo XT-POS mediante contagem física e aprovação escrita.
