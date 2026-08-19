# Regras de Domínio e Negócio — Movax ERP / POS

1. **Tenant Neutrality & Multi-Empresa:**
   - Nenhum nome de empresa piloto deve estar hardcoded na aplicação.
   - Todas as empresas possuem contexto isolado por `company_id`.

2. **Cliente Pontual (Código 1):**
   - O código `1` está reservado para o Cliente Pontual / Consumidor Final.
   - Não pode ser apagado nem desativado.

3. **Cotações vs Facturas:**
   - As cotações (`CUSTOMER_QUOTATION`) não movimentam nem reservam stock físico.
   - Facturas (`CUSTOMER_INVOICE`) e Vendas a Dinheiro (`CASH_SALE`) movimentam stock e geram transações financeiras.

4. **Moeda e Casas Decimais:**
   - Todas as transações monetárias são em Meticais Moçambicanos (**MZN**).
   - Arredondamentos a 2 casas decimais no cálculo final e até 4 casas no rate unitário.
