# Auditoria Funcional Completa por Módulo

## 1. Módulos Operacionais Avaliados

### 1.1 Autenticação e Gestão de Sessão (`APROVADO`)
- **Login/Logout**: Login com e-mail/username e password funcional via Supabase Auth.
- **Alteração Obrigatória de Password**: Flag `forcePasswordChange` detetada no contexto do utilizador força o redirecionamento para o formulário de alteração de credenciais temporárias.
- **Proteção de Rotas**: Tentativas de acesso direto por URL a rotas não autorizadas redirecionam para a página de login ou exibem a mensagem de acesso negado.

### 1.2 Módulo de Vendas & Nova Venda (`APROVADO`)
- **Seleção de Tipo de Documento**: Suporta Factura (FT), Venda a Dinheiro (VD) e Guia de Remessa (GR).
- **Código 1 (Cliente Pontual)**: O código `1` seleciona automaticamente o Cliente Pontual, mantendo os campos de Nome, NUIT e Morada 100% editáveis por venda.
- **Atalho F2**: Gravação e confirmação rápida de documentos através do teclado.
- **Consultar Último Documento (Ctrl+L)**: Carrega o último documento emitido com itens completos em modo de leitura, oferecendo o botão `Copiar para Novo Documento` (que clona o rascunho com a data atualizada de hoje).

### 1.3 Módulo de Cotação (`APROVADO`)
- **Navegação Ultra-Rápida por Enter**:
  `Data Emissão` ➔ `Validade` ➔ `Código Cliente` ➔ `Nome` ➔ `NUIT` ➔ `Morada` ➔ `Artigo` ➔ `Quantidade` ➔ `Preço` ➔ `Desconto %` ➔ Adiciona artigo e foca novamente o campo de pesquisa de artigos.
- **0 Dedução de Stock**: A gravação de cotação cria um documento do tipo `CUSTOMER_QUOTATION` sem executar triggers de abate de inventário.
- **Atualização Instantânea de Histórico**: As novas cotações surgem imediatamente no topo da tabela inferior e abrem no modal de impressão oficial.

### 1.4 Módulo de Gestão de Stock e Movimentos (`APROVADO`)
- **Entradas e Saídas Diretas**: Lançamento em lote de até 99 artigos por guia.
- **Filtro Exato de Código de Artigo**: Na pesquisa do histórico, ao digitar um código numérico como `1`, o sistema filtra estritamente o artigo de código `1`, ignorando números de facturas/guias de outros artigos que contivessem o dígito `1`.
- **Extrato de Movimentos (Artigo)**: Modal com resumo de saldo inicial, entradas, saídas, saldo progressivo e detalhes de cada transação.

### 1.5 Relatórios e Fórmula PVR (`APROVADO`)
- **Vendas por Artigo**: Agrupamento por artigo com filtro por intervalo de datas e por intervalo de códigos (`De X até Y`).
- **Fórmula PVR Personalizável**:
  Painel de cálculo com Margem % (default 25%) e Taxa IVA % (default 16%) editáveis.
  Fórmula: `PVR = PVP × (1 + Margem%) / (1 + IVA%)`.
- **Visibilidade de Colunas**: Botão `👁️ Coluna PVR Visível` / `🙈 Coluna PVR Oculta` que sincroniza a exibição na tabela, na impressão e no ficheiro CSV exportado.

### 1.6 Layout de Impressão Oficial (`APROVADO`)
- **Conformidade de Impressão**: Layout limpo sem logotipos nem carimbos "PAGO" / "DUPLICADO".
- **Elementos Obrigatórios**:
  - Cabeçalho com contactos da empresa (`Av. Karl Marx...`).
  - Contas bancárias da empresa (BCI e BIM com NIBs).
  - Caixas do Cliente (`Exmo.(s) Sr.(s)`).
  - Tabela discriminada de itens.
  - Quadro Resumo do IVA.
  - Subtotal, Desconto e Total Geral.
  - Linha de Total por Extenso em Meticais (`numberToExtensoMZN`).
  - Banner `"MONTAGEM & BALANCEAMENTO GRATUÍTO"`.
