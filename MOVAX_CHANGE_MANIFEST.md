# Movax ERP — Manifesto de Alterações

**Data:** 17 de Agosto de 2026  
**Direcção de produto:** robustez de um ERP tradicional, com operação muito mais simples para o mercado moçambicano.

## Marca e neutralização
- Plataforma renomeada para **Movax ERP / POS**.
- Marca do produto separada da identidade legal do tenant/cliente.
- Dados fiscais, contactos, bancos e cabeçalhos de impressão são dinâmicos por empresa.
- Removidos fallbacks operacionais específicos da Casa de Pneus no runtime.

## Segurança SaaS / multiempresa
- Signup público desactivado.
- Criação de utilizadores passou para Edge Function administrativa e controlada por permissão.
- RLS reforçada para empresa/sucursal/armazém e configurações operacionais.
- Trigger legado que associava utilizadores ao tenant piloto foi neutralizado.
- Auditoria estática de segredos/branding adicionada ao projecto.

## Licenciamento e terminais
- Fundação de planos, subscrições e add-ons por empresa.
- Fundação de terminais POS ligados a sucursal e armazém.
- Contexto operacional persistente por utilizador: sucursal, armazém e terminal.
- Selector de armazém activo disponível na shell principal.

## Catálogo e escala
- Paginação/pesquisa server-side para inventário.
- Pesquisa rápida por código, descrição, marca e barcode.
- Pesquisa consulta stock do armazém activo, não o stock global da empresa.
- Pesquisa server-side ligada a Vendas, Compras, Cotações e Movimentos.
- Tabelas com tipografia maior e cabeçalhos sticky.

## Stock e armazéns
- Fluxo único de Entrada, Saída e Transferência.
- Transferência canónica: `PENDING -> IN_TRANSIT -> RECEIVED`.
- Envio retira stock da origem; recepção adiciona ao destino.
- Cancelamento em trânsito repõe stock na origem.
- Funções de stock de baixo nível deixam de estar expostas directamente ao browser autenticado.

## Vendas e financeiro
- Venda usa o armazém/terminal operacional activo, em vez do primeiro armazém da empresa.
- Compra de fornecedor também usa o contexto operacional activo.
- Venda a Dinheiro passa a criar e alocar o recebimento atomicamente com a venda.
- Métodos que exigem referência validam a referência antes da confirmação.

## Caixa por turno
- Abertura de caixa com fundo inicial.
- Reforço de caixa.
- Sangria com motivo obrigatório.
- Fecho cego: operador introduz apenas dinheiro contado.
- Valor esperado é calculado no servidor após o fecho.
- Diferença/sobra/quebra fica persistida para auditoria.
- Cálculo considera recebimentos/pagamentos em dinheiro do operador durante o turno.

## UX / “ERP robusto, simples de operar”
- Menu agrupado por tarefas: Principal, Stock e Compras, Comercial e Financeiro, Gestão.
- Dashboard orientado a acções do dia.
- Operador vê apenas funções permitidas pela sua função/licença.
- “Nova venda” acessível rapidamente.
- Estado de conectividade não é apresentado falsamente como modo offline.
- Linguagem técnica foi substituída por acções como Vender, Comprar, Receber, Dar Entrada, Dar Saída e Transferir.

## Novas migrations Movax
- `049_movax_multi_tenant_security_hardening.sql`
- `050_movax_licensing_pos_and_transfer_foundation.sql`
- `051_movax_paginated_product_catalog.sql`
- `052_movax_stock_transfer_workflow.sql`
- `053_movax_fast_article_lookup.sql`
- `054_movax_operational_context.sql`
- `055_movax_atomic_cash_sale.sql`
- `056_movax_supplier_invoice_operational_context.sql`
- `057_movax_cash_session_blind_close.sql`

## Validação nesta entrega
- Auditoria de segurança do repositório: **PASS**.
- Auditoria de dados/branding hardcoded no runtime: **PASS**.
- Validador do rollback da migration 016: **PASS**.
- Parser TypeScript: **37 TS/TSX, 0 erros de sintaxe**.
- Build TypeScript/Vite completo: **NÃO ATESTADO nesta máquina**, porque o `node_modules` recebido ficou incompleto/corrompido após a tentativa de reinstalação. O pacote entregue não inclui esse `node_modules`; deve executar `npm ci` num ambiente normal antes de `npm run check`.

## Ainda não concluído
- Aplicar/validar migrations 049–057 numa BD staging limpa e numa cópia da BD real.
- Testes de integração/E2E dos novos fluxos.
- Ligação final de numeração fiscal por série/terminal.
- Administração visual de planos/add-ons/terminais.
- Paginação server-side de clientes, fornecedores e documentos em todos os ecrãs.
- Motor offline real (SQLite/IndexedDB + Outbox + Sync) e empacotamento Windows.
- Leitor de balança EAN-13 e modo supermercado.
- Desmancho/lotes/validade para talho.
- Integração API real M-Pesa/e-Mola e reconciliação.
