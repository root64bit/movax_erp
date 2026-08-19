# GUIA DE CONTEXTO E PROMPT MASTER PARA O LLM

> **Instrução para a Inteligência Artificial:**  
> Você está a trabalhar na evolução do repositório **Movax ERP / POS** (anteriormente protótipo da Casa de Pneus), transformando-o numa plataforma **SaaS Multiempresa (Multi-tenant), Modular, Multi-Sucursal, Multi-Armazém e Offline-First (Windows)** focada no mercado de Moçambique e retalho em geral (Supermercados, Talhos, Lojas de Peças, Comércio e Serviços).

---

## 1. Visão Geral do Repositório

- **Tecnologias Utilizadas:**
  - Frontend: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Zustand / React Context para gestão de estado.
  - Backend & Base de Dados: Supabase (PostgreSQL), Row Level Security (RLS), Edge Functions.
  - Testes: Playwright E2E.
- **Estrutura de Pastas Principal:**
  - `src/components/`: Componentes modulares reutilizáveis (POS, Vendas, Stock, Compras, Finanças, Faturas, Relatórios, etc.).
  - `src/pages/`: Ecrãs principais da aplicação.
  - `src/types/`: Definições TypeScript (`Article`, `SaleInvoice`, `StockMovement`, `Company`, `Warehouse`, `Branch`, `Subscription`).
  - `src/lib/`: Configurações de clientes (Supabase, utilitários fiscais de IVA/cálculo, formatação em Meticais MZN).
  - `supabase/migrations/`: Ficheiros SQL com o esquema de base de dados, tabelas, triggers e RLS.

---

## 2. Emuladores Locais, Execução no Windows e Migração Futura para Vercel

### A. Emulação e Desenvolvimento Local (Offline & Windows)
1. **Emulador de Base de Dados Local:**
   - O projeto deve suportar execução 100% local no Windows para desenvolvimento, testes e modo offline.
   - Suporte ao **Supabase CLI Local Stack** (`supabase start` via Docker/PostgreSQL local) com emulação completa de:
     - PostgreSQL Database (porta `54322`)
     - Autenticação e JWT
     - PostgREST API (porta `54321`)
     - Supabase Studio Local (`http://127.0.0.1:54323`)
     - Edge Functions e Storage
   - Fallback para **SQLite / Local Storage / IndexedDB** no frontend quando o terminal POS no Windows estiver a operar sem qualquer servidor ativo.
2. **Execução Local da Plataforma:**
   - Frontend executável localmente via `npm run dev` (Vite) ou compilado como executável desktop (Electron / PWA / Webview local).

### B. Estratégia de Deploy e Migração para a Vercel
1. **Deploy na Vercel (Produção SaaS):**
   - A plataforma foi desenhada para ser hospedada na **Vercel** como aplicação de alta disponibilidade e latência ultra-baixa com CDN global.
   - Configuração de roteamento SPA em `vercel.json` (redirecionamento de todas as rotas `/` para `/index.html` para suporte a React Router).
   - Gestão de Ambientes na Vercel:
     - `Development / Preview`: Conectado a instâncias de staging / emuladores locais de teste.
     - `Production`: Conectado ao cluster Supabase Cloud em produção com SSL, backups automatizados e RLS restrito por `company_id`.
2. **Fluxo de Migração Local -> Vercel:**
   - Desenvolvimento & testes locais com o emulador -> Execução de testes Playwright E2E -> Build validado (`npm run build`) -> Deploy automático via GitHub Actions / Vercel CLI (`vercel --prod`).

---

## 3. Objetivos Chave da Transformação SaaS

Ao trabalhar neste projeto ou implementar novas funcionalidades, siga rigorosamente estas diretrizes:

### A. Isolamento Multiempresa (Multi-Tenant)
1. **Nunca use dados estáticos ou hardcoded** de clientes específicos (como Casa de Pneus, NUITs fixos ou contas bancárias fixas).
2. Todas as tabelas operacionais devem ter a coluna `company_id UUID NOT NULL REFERENCES companies(id)`.
3. Todos os cabeçalhos de faturas, recibos e relatórios de impressão devem puxar os dados do estado da empresa atual (`currentCompany`).

### B. Gestão de Sucursais e Armazéns
1. **Estrutura:** `Empresa (Company)` -> `Sucursais (Branches)` -> `Armazéns (Warehouses)` -> `Terminais / Caixas (POS Terminals)`.
2. As vendas no POS devem abater o stock diretamente no armazém associado àquele terminal/sucursal.
3. As transferências entre armazéns devem seguir o ciclo:
   - `PENDING` -> `IN_TRANSIT` (saída do armazém de origem com Guia de Transporte) -> `RECEIVED` (entrada confirmada pelo destino).

### C. Módulos Específicos de Retalho (Supermercado e Talho)
1. **Supermercados:**
   - Leitura de código de barras de alta velocidade.
   - Suporte a etiquetas de balança (EAN-13 com prefixo 20/21 para peso e preço embutido).
   - Fecho cego de caixa por operador com contagem física de valores e cálculo de sobras/quebras.
2. **Talhos:**
   - Desmancho de carcaças / transformação de stock (1 entrada de peça bruta -> várias saídas de cortes nobres e subprodutos).
   - Rastreio de lotes e datas de validade.

### D. Modo Offline-First no Windows & Sincronização Cloud
1. O POS deve ser capaz de operar localmente sem conexão ativa à internet.
2. A numeração de faturas deve ser particionada por terminal (ex: `FR MAP01-CX01/2026/0001`) para evitar colisões entre caixas da mesma loja.
3. Quando a internet estiver disponível, o sync envia os dados pendentes para o Supabase via *Outbox Pattern* com chave de idempotência.

---

## 4. Modelo de Licenciamento e Feature Gating

Verifique sempre a licença ativa da empresa (`subscription.active_addons` e `subscription.plan_tier`):
- `CORE`: POS básico, Faturação, Catálogo de Artigos, Clientes, Stock Básico, 1 Loja, 1 Armazém.
- `ADVANCED_STOCK`: Múltiplos armazéns, transferências, histórico de movimentos detalhado.
- `PURCHASES`: Faturas de fornecedores e cálculo automático de preço de venda / margem.
- `FINANCIAL`: Contas correntes, recibos, liquidações a prazo.
- `BI_PRO`: Relatórios analíticos avançados e mapa fiscal de IVA.
- `SUPERMARKET_POS`: Frente de caixa ultra-rápida, caixas múltiplos, leitor de balança e fecho cego.
- `BUTCHER_MODULE`: Desmancho de carnes e conversão de carcaças.

Utilize o padrão:
```tsx
if (!hasAddon(company, 'ADVANCED_STOCK')) {
  return <UpgradePlanModal addon="ADVANCED_STOCK" />;
}
```

---
*Consulte o documento `PLATAFORMA_ERP_POS_MULTIEMPRESA.md` para obter a especificação detalhada de preços em MZN, estrutura de tabelas SQL, emuladores e modelo comercial.*
