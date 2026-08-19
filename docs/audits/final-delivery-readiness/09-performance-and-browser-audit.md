# Auditoria de Performance, Responsividade e Compatibilidade

## 1. Métricas de Performance de Compilação e Carregamento

| Recurso | Tamanho Bruto | Tamanho Gzip | Tempo de Carregamento Estimado (3G) |
| :--- | :---: | :---: | :---: |
| **`index.html`** | 1.01 kB | 0.54 kB | < 50ms |
| **`index-CIPVNBYa.css`** (Tailwind v4) | 58.97 kB | 10.86 kB | < 150ms |
| **`index-D8YrSJeo.js`** (App Logic) | 672.49 kB | 171.69 kB | < 800ms |

- **Tempo Total de Compilação Vite**: `2.34s` - `5.85s`
- **Paginação de Tabelas**: O componente `Pagination.tsx` limita a renderização do DOM a 15, 25, 50 ou 100 linhas por página, prevenindo congelamentos do navegador mesmo em catálogos de 100.000 artigos.

---

## 2. Testes de Responsividade por Resolução

| Resolução Avaliada | Tipo de Dispositivo | Estado da Interface | Ajustes Efetuados |
| :--- | :--- | :---: | :--- |
| **360 × 800** | Smartphone Android | `APROVADO` | Grelha do formulário colapsa para 1 coluna limpa. |
| **390 × 844** | iPhone 13/14 | `APROVADO` | Sem transbordo horizontal (overflow-x cortado). |
| **768 × 1024** | iPad / Tablet | `APROVADO` | Tabelas com scroll horizontal inteligente. |
| **1366 × 768** | Portátil Standard | `APROVADO` | Layout otimizado para ecrã de balcão de vendas. |
| **1920 × 1080** | Monitor Full HD | `APROVADO` | Ecrã inteiro e barra inferior bem alinhada. |

---

## 3. Compatibilidade por Navegador

| Navegador | Versão | Estado | Observação |
| :--- | :--- | :---: | :--- |
| **Google Chrome** | v120+ | `APROVADO` | Total suporte a atalhos de teclado (F2, F3, F4, Ctrl+L, Enter). |
| **Microsoft Edge** | v120+ | `APROVADO` | Comportamento idêntico ao Chrome. |
| **Mozilla Firefox**| v121+ | `APROVADO` | Renderização CSS e impressão sem falhas. |
| **Apple Safari** | macOS / iOS | `NÃO VERIFICADO` | Requer validação em hardware Apple físico no piloto. |
| **Impressora Térmica / A4 Física** | Hardware | `NÃO VERIFICADO` | Pendente de teste com impressora física no balcão do cliente. |
