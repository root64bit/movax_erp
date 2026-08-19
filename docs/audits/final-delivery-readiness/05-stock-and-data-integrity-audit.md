# Auditoria de Stock e Integridade de Dados

## 1. Validação Matemática da Fórmula do Saldo de Stock
O saldo de stock no sistema Casa de Pneus obedece rigorosamente à igualdade:

$$\text{Stock Atual} = \text{Stock Inicial} + \sum \text{Entradas Confirmadas} - \sum \text{Saídas Confirmadas} \pm \text{Reversões}$$

### Validações Efetuadas:
1. **Facturas e Vendas a Dinheiro (VD)**: A confirmação de uma venda invoca o RPC `create_and_confirm_customer_sale` que abate o stock em lote dentro de uma transação atómica PostgreSQL.
2. **Guias de Entrada e Saída Directa**: A submissão de guias de stock (até 99 itens) atualiza o inventário atomicamente e regista as entradas/saídas na tabela `stock_movements`.
3. **Cotações**: A emissão de cotações gera um documento `CUSTOMER_QUOTATION` e **não deduz nem altera o saldo físico de stock** (0 alteração).

---

## 2. Verificação de Consistência entre Módulos
- **Stock no Ficheiro de Artigos (`Inventory.tsx`)**: O valor de stock exibido na tabela de artigos coincide com a soma acumulada dos movimentos registados no Extrato do Artigo (`ArticleLedgerModal.tsx`).
- **Resumo do Cartão de Stock Total**: O indicador de "Qtd. Total em Stock" nos resumos calcula a soma exata dos artigos filtrados na listagem.
- **Histórico de Movimentos (`StockMovements.tsx`)**: A pesquisa por código numérico exato (ex: `1`) filtra estritamente os registos pertença desse artigo sem misturar documentos de outros artigos que contivessem o dígito `1`.
