# Movax ERP — Relatório de Implementação

**Data:** 17 de Agosto de 2026  
**Objectivo:** evoluir o sistema para um ERP/POS multiempresa robusto, mas muito simples de operar no contexto moçambicano.

## 1. Direcção do produto

O Movax ERP deve oferecer a disciplina de um ERP tradicional — documentos, stock, contas correntes, permissões, auditoria, filiais, armazéns e caixa — sem obrigar o utilizador comum a navegar por conceitos técnicos.

A operação foi organizada à volta de tarefas reais:

- **Vender**
- **Comprar**
- **Receber / Pagar**
- **Dar Entrada / Dar Saída**
- **Transferir Stock**
- **Abrir / Fechar Caixa**
- **Consultar dívida e stock**
- **Gerir apenas o que a função do utilizador permite**

A plataforma chama-se **Movax ERP / POS**. Casa de Pneus permanece apenas como tenant piloto e referência histórica de dados.

## 2. O que foi implementado nesta passagem

### 2.1 Segurança multiempresa

Foi removida a lógica perigosa em que novos utilizadores podiam ser associados automaticamente ao tenant piloto. O signup público foi desactivado e a criação de utilizadores passa por um fluxo administrativo controlado. As políticas RLS base foram endurecidas para garantir contexto de empresa.

### 2.2 Licenciamento e estrutura operacional

Foi criada a fundação de:

- planos e subscrições;
- add-ons;
- terminais POS;
- limites de utilizadores/sucursais/armazéns/terminais;
- contexto activo de sucursal, armazém e terminal por utilizador.

Isto separa **licença da empresa** de **permissão do utilizador**.

### 2.3 Artigos com 23.000+ registos

O catálogo deixou de depender exclusivamente do carregamento inicial do browser. Foi adicionada paginação e pesquisa server-side no PostgreSQL, incluindo pesquisa rápida por:

- código;
- barcode;
- descrição;
- marca.

A pesquisa pode ser limitada ao armazém activo, mostrando a existência correcta da loja/armazém em que o operador está a trabalhar. A mesma fundação foi ligada a Vendas, Compras, Cotações e Movimentos.

### 2.4 Contexto operacional real

Vendas e compras deixaram de seleccionar silenciosamente o primeiro armazém da empresa. O utilizador trabalha num contexto activo persistido e pode mudar o armazém permitido na shell da aplicação.

Isso é essencial para Maputo, Matola, Beira, Nampula ou qualquer rede com mais de uma filial.

### 2.5 Transferências de stock

O fluxo foi simplificado para três estados claros:

1. **Preparar**
2. **Em trânsito**
3. **Recebida**

Ao enviar, o stock sai da origem. Ao receber, entra no destino. Se uma transferência em trânsito for cancelada, o stock regressa à origem com movimento auditável.

### 2.6 Venda a Dinheiro

A Venda a Dinheiro foi corrigida para que “paga” no ecrã signifique efectivamente “liquidada” na base de dados. Venda, recebimento e alocação são processados de forma atómica/idempotente.

### 2.7 Caixa por turno e fecho cego

Foi criada a fundação operacional de caixa:

- abertura com fundo inicial;
- reforço;
- sangria com motivo obrigatório;
- fecho cego com dinheiro contado;
- cálculo server-side do esperado;
- apuramento de sobra/quebra;
- histórico de turnos.

Enquanto o caixa está aberto, o operador não recebe o valor esperado. Depois de confirmar o fecho, o sistema revela esperado, contado e diferença.

### 2.8 UX mais simples

O menu passou a estar agrupado por função de negócio, e não por arquitectura técnica. O dashboard apresenta acções do dia e os ecrãs usam linguagem operacional. As tabelas têm tipografia maior e melhor leitura para balcão e monitores de escritório.

## 3. Estado técnico de validação

Nesta cópia foram executadas as validações que não dependem de uma instalação funcional de `node_modules`:

- **Security audit:** PASS
- **Static operational-data / branding audit:** PASS
- **Migration 016 rollback contract:** PASS
- **Parsing TypeScript:** 37 ficheiros TS/TSX, 0 erros de sintaxe

O build completo `tsc + vite build` não é declarado como PASS nesta máquina porque as dependências locais fornecidas ficaram incompletas/corrompidas durante a reinstalação. O pacote final remove esse `node_modules`. Num ambiente de desenvolvimento normal, executar:

```bash
npm ci
npm run check
```

## 4. Migrations novas desta implementação

| Migration | Finalidade |
|---|---|
| 049 | Hardening multi-tenant/RLS e provisioning |
| 050 | Licenciamento, add-ons e POS terminals |
| 051 | Catálogo paginado server-side |
| 052 | Workflow seguro de transferências |
| 053 | Pesquisa rápida de artigos/barcodes |
| 054 | Contexto operacional por utilizador |
| 055 | Venda a Dinheiro + recebimento atómico |
| 056 | Compras usam armazém operacional activo |
| 057 | Caixa por turno + fecho cego |

## 5. O que deve ser feito antes de chamar isto “pronto para produção”

### Prioridade P0

1. Aplicar migrations 049–057 numa base staging limpa.
2. Aplicar numa cópia/snapshot da base real e verificar compatibilidade dos dados existentes.
3. Reinstalar dependências e executar `npm run check` completo.
4. Criar testes de integração para isolamento Tenant A/Tenant B.
5. Testar concorrência de venda, stock, transferência e fecho de caixa.
6. Testar utilizador Administrador, Manager, Caixa, Stock e Compras separadamente.

### Prioridade P1

1. Integrar definitivamente a série/número fiscal por terminal POS.
2. Criar administração visual de terminais, planos e add-ons.
3. Tornar clientes, fornecedores e documentos totalmente server-paginated.
4. Criar relatório de fecho de caixa para gerente com filtros por operador/loja/data.
5. Melhorar POS com modo de teclado/barcode ainda mais rápido.

### Prioridade P2

1. Motor offline real para Windows: SQLite/IndexedDB + Outbox + Sync idempotente.
2. Empacotamento Electron/Tauri e impressão térmica local.
3. Supermercado: EAN-13 de balança, múltiplos caixas e atalhos de supervisor.
4. Talho: lotes, validade, desmancho e rendimento.
5. Integração M-Pesa/e-Mola com callback e reconciliação.

## 6. Visão final recomendada

O Movax não deve tentar mostrar ao utilizador “tudo o que um ERP consegue fazer”. Deve mostrar **a próxima acção correcta** para aquela função.

Um Caixa precisa de vender, receber e fechar turno. Um operador de stock precisa de entrada, saída, transferência e inventário. Um comprador precisa de fornecedores e compras. Um gestor precisa de indicadores, aprovações, contas e relatórios. O Administrador configura o resto.

Essa separação é o que permite ter profundidade de ERP sem criar a sensação de complexidade dos sistemas tradicionais.
