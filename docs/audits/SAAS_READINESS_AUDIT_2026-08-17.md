# Movax ERP / POS — Auditoria de Prontidão SaaS

**Data:** 17 de Agosto de 2026  
**Base auditada:** pacote `KUVHA_ERP_POS_MULTIEMPRESA_SAAS.zip` + especificação de produto e prompt master incluídos no pacote  
**Nova marca de plataforma:** **Movax ERP / POS**  
**Slogan de trabalho:** **O seu negócio, bem gerido.**  
**Tenant piloto preservado:** **Casa de Pneus, Lda.**

---

## 1. Conclusão Executiva

O código recebido é um **ERP/POS operacional com uma boa fundação para evolução SaaS**, mas **não é ainda uma plataforma SaaS multiempresa pronta para comercialização geral**.

O núcleo de negócio está significativamente desenvolvido: autenticação, RBAC, vendas, documentos comerciais, compras, artigos, stock, movimentos, clientes, fornecedores, contas correntes, pagamentos, relatórios, administração, auditoria operacional e estruturas de sucursal/armazém.

A diferença principal entre o código real e o blueprint é que várias capacidades descritas como arquitetura-alvo ainda não existem no repositório: licenciamento modular, terminais POS, séries por terminal, motor offline/outbox, sincronização bidirecional, caixa rápido de supermercado, balanças EAN-13, fecho cego, módulo de talho/desmancho e provisioning completo de novos tenants.

**Decisão:**

- **Piloto cloud de uma empresa:** possível depois de fechar os P0 de segurança/reprodutibilidade.
- **Venda como SaaS multiempresa:** **NÃO** antes de fechar tenant isolation, tenant provisioning e licenciamento.
- **Venda como “offline-first Windows”:** **NÃO**; o motor offline ainda não existe.
- **Casa de Pneus:** deve permanecer apenas como tenant/cliente piloto, nunca como identidade do produto.

---

## 2. Alterações de Rebranding Aplicadas Nesta Cópia

A cópia auditada foi neutralizada para **Movax ERP / POS** sem alterar a identidade legal do tenant piloto.

### Aplicado

- `package.json`: `movax-erp-pos`.
- `<title>` do browser: `Movax ERP / POS — Gestão Empresarial`.
- Novo `src/lib/branding.ts` com:
  - `PLATFORM_NAME = Movax`
  - `PLATFORM_PRODUCT_NAME = Movax ERP / POS`
  - `PLATFORM_TAGLINE = O seu negócio, bem gerido.`
- Login passa a mostrar a marca da plataforma, não o primeiro tenant da base.
- Layout deixa de usar Casa de Pneus como fallback de empresa.
- Favicon `CP` substituído por marca neutra `BG`.
- Metadados Stitch neutralizados.
- Rodapé de impressão genérica passa a referir Movax.
- Identificação antiga `SEIP(v1.0) / Licença DAFM1` foi removida do documento genérico e substituída pela identidade da plataforma.
- Banners fixos de oferta de nitrogénio e montagem/balanceamento foram removidos da impressão genérica.
- Copy específica de pneus (`Novo Pneu`, `Item / Pneu`, garantias de pneus) foi neutralizada para `Artigo`.
- Testes E2E foram renomeados para Movax.
- URL de produção Casa de Pneus removida do default do Playwright.
- Credenciais E2E em texto claro foram removidas e substituídas por variáveis de ambiente.
- `.env.example` agora declara as variáveis E2E sem valores reais.
- Documentos `PLATAFORMA_ERP_POS_MULTIEMPRESA.md` e `LLM_CONTEXT_PROMPT.md` foram atualizados para Movax.

### Correção crítica de neutralidade fiscal

`PrintInvoiceModal.tsx` tinha nome, morada, NUIT, telefone, email e contas bancárias da Casa de Pneus diretamente no JSX.

Na cópia corrigida, o documento usa:

- `company.name`
- `company.taxNumber`
- `company.address`
- `company.city`
- `company.phone`
- `company.email`
- `company.bankAccounts`

Assim, **Movax é a plataforma** e **a empresa ativa é o emissor legal do documento**.

### Dados bancários e notas comerciais

Foram removidos fallbacks de BCI/BIM e a observação comercial específica de pneus/montagem. Dados dessa natureza devem vir da configuração do tenant.

### O que NÃO foi renomeado de propósito

As migrations históricas que criam/semeiam o tenant piloto Casa de Pneus não foram reescritas. Alterar migrations já aplicadas quebra a rastreabilidade do banco. A evolução SaaS deve ser feita por migrations novas e por um fluxo explícito de tenant provisioning.

---

## 3. Matriz de Prontidão

| Área | Estado | Auditoria |
|---|---|---|
| Vendas / POS base | 🟢 Forte | Fluxos e documentos base presentes |
| Artigos / Catálogo | 🟢 Forte | Produtos, preços, IVA, categorias, marcas e stock |
| Compras / Fornecedores | 🟢/🟡 | Implementado; requer validação final multi-tenant |
| Clientes / Contas correntes | 🟢/🟡 | Implementado |
| Relatórios | 🟡 | Bons relatórios existentes, mas escalabilidade de carga precisa evoluir |
| RBAC | 🟢/🟡 | Fundação robusta; tenant provisioning ainda conflita com o modelo SaaS |
| Auditoria operacional | 🟢/🟡 | Vários eventos e RPCs seguros existentes |
| Branding neutro | 🟢 nesta cópia | Rebranding de plataforma aplicado |
| Documentos fiscais multiempresa | 🟢 nesta cópia | Cabeçalho hardcoded removido |
| `company_id` nas estruturas principais | 🟢/🟡 | Amplamente presente |
| RLS multiempresa | 🔴 | Políticas-base ainda expõem/fixam tenant incorretamente |
| Criação/provisioning de tenant | 🔴 | Não existe onboarding SaaS completo |
| Criação segura de utilizadores multiempresa | 🔴 | Trigger histórico força o tenant piloto |
| Sucursais / armazéns | 🟡 | Modelo presente; gestão SaaS completa/provisioning não fechados |
| Transferências entre armazéns | 🟡 | Tabelas presentes; contrato de estados diverge do blueprint |
| Terminais POS | 🔴 | `pos_terminals` não existe |
| Séries fiscais por terminal | 🔴 | Modelo definido no blueprint, não implementado como terminal SaaS |
| Licenciamento / planos / add-ons | 🔴 | `subscriptions`, `active_addons`, `plan_tier`, `FeatureGuard` ausentes |
| Supermercado / balanças | 🔴 | Sem parser EAN-13 de peso/preço; sem caixa rápido dedicado |
| Fecho cego / sangria / reforço | 🔴 | Não encontrado no código atual |
| Talho / desmancho | 🔴 | Não encontrado |
| Lotes / validade | 🔴 | Não encontrado como motor operacional do vertical |
| M-Pesa/e-Mola API | 🔴 | Existem métodos de pagamento de referência, não integração automática |
| Offline-first Windows | 🔴 | Sem Electron/Tauri/SQLite/IndexedDB/outbox/sync worker |
| Build reproduzível do pacote recebido | 🔴 | Diretório `scripts/` referenciado pelo `package.json` está ausente |
| Segurança de segredos | 🔴 → 🟡 nesta cópia | Credenciais E2E removidas do código; rotação externa ainda necessária se válidas |

---

## 4. P0 — Bloqueadores Antes de Abrir a Plataforma a Várias Empresas

### P0.1 — RLS de `companies` não isola tenants

A migration inicial cria:

```sql
CREATE POLICY "companies_select_policy" ON public.companies
FOR SELECT TO authenticated USING (true);
```

Um utilizador autenticado pode, portanto, ler perfis de empresas que não são a sua, salvo se uma migration externa não presente neste pacote tiver alterado a política. Não foi encontrada migration posterior que substitua essa policy.

**Correção:** `id = public.get_user_company_id()` ou uma política equivalente baseada em membership.

---

### P0.2 — RLS de branches/warehouses/configuração está preso à Casa de Pneus

As policies iniciais de:

- `branches`
- `warehouses`
- `company_settings`
- `fiscal_periods`
- `document_sequences`

usam diretamente:

```sql
company_id = 'a0000000-0000-0000-0000-000000000001'
```

Esse UUID é o tenant piloto. Isso não é um modelo SaaS.

**Correção:** substituir por `public.get_user_company_id()` e acrescentar scopes de branch/warehouse quando aplicável.

---

### P0.3 — `document_types` e `payment_methods` são company-scoped mas a leitura é global

Ambas as tabelas têm `company_id`, mas as policies usam `USING (true)`.

**Correção:** decidir formalmente se são catálogos globais ou tenant-scoped. No schema atual são tenant-scoped; portanto a leitura deve ser filtrada pela empresa.

---

### P0.4 — Criação de utilizadores está acoplada ao tenant piloto

O trigger histórico `handle_new_user()` define:

```sql
default_company_id := 'a0000000-0000-0000-0000-000000000001';
```

Também fixa role, branch e warehouse do piloto.

Há um problema adicional no fluxo do frontend:

1. `Administration` cria a credencial usando `auth.signUp()`.
2. Esse signup dispara `handle_new_user()`.
3. O perfil é criado no tenant Casa de Pneus.
4. Depois `admin_create_user_profile()` faz `ON CONFLICT (id) DO UPDATE`, mas **não muda `company_id`**.

Logo, num futuro tenant B, um administrador que crie um utilizador poderá acabar com esse utilizador ligado à Casa de Pneus.

**Correção recomendada:**

- retirar criação administrativa via `auth.signUp()` do browser;
- criar uma Edge Function / endpoint backend protegido com service role;
- resolver `company_id` exclusivamente a partir do administrador autenticado;
- criar `auth.users + user_profile + roles + scopes` como um fluxo controlado;
- proibir auto-inscrição aberta para o ERP B2B, salvo fluxo explícito de convite.

---

### P0.5 — Signup está habilitado no `supabase/config.toml`

O repositório contém:

```toml
enable_signup = true
```

Combinado com o trigger anterior, isso é incompatível com um ERP B2B multiempresa seguro.

**Nota:** esta configuração prova o estado do repositório/local stack; a configuração real do Supabase Cloud deve ser verificada separadamente.

---

### P0.6 — Credenciais E2E estavam em texto claro

Foram encontradas credenciais com aparência de credenciais reais dentro de:

- `e2e/qa-platform-suite.spec.ts`
- `e2e/qa-latest-features.spec.ts`
- `e2e/test-quotation-emit.spec.ts`

A auditoria anterior do pacote dizia não haver passwords em `src/`; isso não cobria adequadamente `e2e/`.

**Nesta cópia:** removidas e substituídas por `E2E_*`.

**Ação fora do código:** rotacionar imediatamente qualquer password encontrada no repositório que continue válida.

---

### P0.7 — `.gitignore` não veio no pacote

Os documentos de auditoria afirmam que `.env` está ignorado, mas o pacote recebido não contém `.gitignore`.

**Nesta cópia:** deve ser criado antes de qualquer novo commit.

---

### P0.8 — Pipeline não reproduzível

`package.json` depende de:

- `scripts/clean_sites_build.js`
- `scripts/prepare_sites_build.js`
- `scripts/audit-static-operational-data.js`
- `scripts/audit-repository-security.js`
- `scripts/validate_migration_016_rollback.js`

O diretório `scripts/` não existe no ZIP recebido.

`npm run check` falha de forma determinística com `MODULE_NOT_FOUND`.

**Ação:** recuperar esses scripts do repositório/commit de origem ou redefinir oficialmente o pipeline. Não criar scripts “dummy” apenas para tornar o check verde.

---

## 5. Multiempresa — O Que Já Está Bom

Há uma base real para multi-tenancy:

- tabela `companies`;
- `user_profiles.company_id`;
- `roles.company_id`;
- branches e warehouses com `company_id`;
- products e várias tabelas operacionais com `company_id`;
- helper `get_user_company_id()`;
- `get_current_user_context()`;
- branch access e warehouse access;
- várias policies modernas usam `company_id = public.get_user_company_id()`;
- vários RPCs usam `SECURITY DEFINER` com verificações de permissão.

A conclusão não é “refazer tudo”. É **fechar as exceções históricas e construir provisioning SaaS correto**.

---

## 6. Sucursais, Armazéns e Transferências

### Já existe

- `branches`
- `warehouses`
- `inventory_balances`
- `stock_movements`
- `stock_transfers`
- `stock_transfer_lines`
- scopes por branch/warehouse

### Lacunas

O blueprint define o ciclo:

`PENDING -> IN_TRANSIT -> RECEIVED`

O schema atual usa:

`draft -> confirmed -> received -> cancelled`

Não foi encontrado um módulo frontend completo para operar a transferência em duas fases descrita na especificação.

**Decisão recomendada:** adotar formalmente uma única máquina de estados e adicionar:

- despacho;
- stock em trânsito;
- receção parcial/completa;
- divergência entre enviado/recebido;
- utilizador/data de despacho;
- utilizador/data de receção;
- auditoria;
- concorrência/idempotência.

---

## 7. POS Terminals — Falta a Camada que Liga Caixa, Sucursal, Armazém e Série

Não foi encontrada tabela/modelo `pos_terminals`.

Para a arquitetura pretendida, cada terminal deve ter pelo menos:

- `company_id`
- `branch_id`
- `default_warehouse_id`
- `terminal_code`
- série/prefixo fiscal
- estado ativo
- identificação do dispositivo
- política offline
- última sincronização

Essa entidade é pré-requisito para:

- múltiplos caixas na mesma loja;
- séries fiscais sem colisão;
- offline-first;
- auditoria por dispositivo;
- fecho de caixa por terminal.

---

## 8. Licenciamento Modular — Blueprint Ainda Não Implementado

Não foram encontrados no código:

- `subscriptions`
- `active_addons`
- `plan_tier`
- `FeatureGuard`
- `hasAddon`

O RBAC existente resolve **quem pode fazer o quê**, mas não resolve **o que a empresa contratou**.

Esses dois conceitos devem permanecer separados:

1. **Entitlement/licença da empresa** — plano e add-ons.
2. **Permissão do utilizador** — RBAC.

### Modelo recomendado

- `plans`
- `features`
- `plan_features`
- `subscriptions`
- `subscription_addons`
- limites: users/branches/warehouses/terminals
- `assert_feature(company_id, feature_code)` no servidor
- helper de leitura no frontend

**Regra:** UI hiding nunca substitui validação backend.

---

## 9. Offline-First — Ainda Não Implementado

A especificação descreve SQLite/IndexedDB, Outbox Pattern, idempotency key e sync worker.

No código atual há idempotency keys em vários RPCs, o que é uma boa fundação, mas **não existe motor offline local**.

Não foram encontrados:

- Electron;
- Tauri;
- SQLite local;
- IndexedDB operacional;
- outbox local;
- `sync_status`;
- worker de push/pull;
- deteção de connectivity para fila transacional;
- resolução de conflito cliente-servidor;
- packaging Windows.

### Arquitetura recomendada

Para POS Windows, preferir **Tauri + SQLite** ou Electron + SQLite, mantendo React/Vite como UI.

Local:

- catálogo cacheado;
- preços/regras;
- clientes essenciais;
- terminal config;
- documentos offline;
- stock movement outbox;
- payment outbox;
- tabela `sync_outbox`;
- tabela `sync_checkpoint`.

Cloud:

- API/RPC idempotente;
- server authority para preços/configuração;
- append-only para vendas/movimentos;
- reconciliação por terminal.

---

## 10. Supermercado e Talho — Ainda São Roadmap

### Supermercado

Não foi encontrado parser operacional para EAN-13 de balança, caixa rápido dedicado, fecho cego, sangria ou reforço.

### Talho

Não foi encontrado motor de:

- carcaça -> cortes;
- rendimento;
- quebra;
- lotes de produção;
- validade;
- rastreabilidade por transformação.

Esses módulos devem continuar feature-gated e não serem apresentados comercialmente como prontos.

---

## 11. M-Pesa / e-Mola

Há métodos de pagamento `M-Pesa`, `e-Mola` e outros no seed/configuração de pagamentos.

Isso **não equivale a integração API**.

Não foi encontrado fluxo de:

- criação de cobrança;
- callback/provider webhook;
- confirmação assíncrona;
- reconciliação automática;
- retries/idempotência de provider.

Estado correto: **método de registo manual disponível; integração automática pendente**.

---

## 12. Escalabilidade — 23.000+ Artigos e Grandes Históricos

Existe um componente de paginação e ele já é usado em algumas áreas, incluindo movimentos, relatórios e cotações.

Porém `loadAppData()` ainda traz conjuntos relativamente grandes para memória do browser com limites fixos, por exemplo:

- produtos: `limit(2000)`;
- inventory balances: `limit(2000)`;
- clientes: `limit(2000)`;
- fornecedores: `limit(500)`;
- documentos: RPC com `p_limit: 1000`;
- movimentos: `limit(100)`;
- pagamentos: `limit(2000)`;
- ledger: `limit(1000)`.

Para 23.000+ artigos isto não é suficiente e pode criar **cortes silenciosos**: o utilizador pode pensar que está a pesquisar todo o catálogo quando apenas parte foi carregada.

### Correção

Migrar listagens principais para paginação/filter/sort **server-side**:

- cursor pagination para produtos e documentos;
- busca no PostgreSQL;
- filtros enviados ao servidor;
- virtualização de tabela quando necessário;
- contagem separada;
- cache por página/query.

Nenhum ecrã deve renderizar 23.000 linhas de uma vez.

---

## 13. Alerta de Stock Baixo — Implementação Existente é Melhor que um “< 10” Fixo

O código já trata stock crítico com:

```ts
article.stock <= article.minStock
```

Isso é melhor do que uma regra global fixa de 10 unidades.

Recomendação:

- manter `min_stock` configurável por artigo/armazém;
- permitir default 10 por tenant apenas como valor inicial opcional;
- notificação persistente no dashboard;
- filtro “Stock crítico” no inventário;
- futura notificação email/app somente se o cliente ativar.

---

## 14. Notas de Crédito e Débito

O backend/schema contém códigos de documento para crédito e débito, mas a UI financeira encontrada é explicitamente orientada a **crédito**:

- `FinancialAdviceDocument` aceita `adviceType?: 'CREDIT'`;
- Entities expõe “Nota de Crédito”;
- Documents filtra notas de crédito.

Não foi encontrada uma UI equivalente completa de emissão de **Nota de Débito**.

Estado: **crédito implementado; débito precisa de fechamento funcional/UI antes de ser marcado concluído**.

---

## 15. Ordem de Implementação Recomendada

### Fase 0 — Segurança e Tenant Isolation

1. Rotacionar credenciais expostas.
2. Criar `.gitignore` e secret scanning em CI.
3. Recuperar `scripts/` ausentes.
4. Corrigir RLS de companies/branches/warehouses/company settings/fiscal periods/sequences/document types/payment methods.
5. Remover provisioning hardcoded do tenant piloto.
6. Implementar convite/criação administrativa de utilizador server-side.
7. Criar testes de tenant A vs tenant B tentando acesso cruzado.

**Gate:** nenhum cross-tenant read/write possível.

### Fase 1 — Tenant Provisioning SaaS

1. `create_company` administrativo.
2. criação de primeira branch;
3. primeiro warehouse;
4. roles padrão;
5. document types;
6. payment methods;
7. payment terms;
8. tax codes;
9. fiscal period;
10. sequences;
11. admin inicial;
12. branding/dados fiscais.

Tudo idempotente e auditado.

### Fase 2 — Licensing & Add-ons

Implementar plans/features/subscriptions/add-ons e enforcement backend/frontend.

### Fase 3 — POS Terminals

Criar terminal, associação branch/warehouse, séries por terminal, caixa por terminal e auditoria.

### Fase 4 — Multi-warehouse completo

Fechar transferência em duas etapas e stock em trânsito.

### Fase 5 — Escala de dados

Produtos/documentos/clientes com paginação server-side e busca real.

### Fase 6 — Offline Windows

Tauri/Electron + SQLite + outbox + pull/push + reconciliação.

### Fase 7 — Verticais

Supermercado, balanças, fecho cego; depois Talho/Desmancho.

### Fase 8 — Integrações

M-Pesa/e-Mola, fiscal/contabilidade, API aberta, BI adicional.

---

## 16. Testes de Aceitação Obrigatórios para o SaaS

### Tenant isolation

- Tenant A não lê company B.
- A não lê products/customers/suppliers/documents/payments/ledger de B.
- A não lê branches/warehouses de B.
- IDs conhecidos de B continuam bloqueados.
- RPCs `SECURITY DEFINER` validam tenant antes de qualquer operação.

### User provisioning

- Admin de A cria user -> user pertence a A.
- Admin de B cria user -> user pertence a B.
- Nenhum signup público cria acesso operacional sem convite.
- Roles atribuídas pertencem ao mesmo company_id.

### Licensing

- empresa sem addon não consegue endpoint nem UI;
- bypass direto à API é bloqueado;
- limites de users/branches/terminals são transacionais.

### POS / stock

- venda baixa o warehouse do terminal correto;
- dois terminais não colidem séries;
- transferência não duplica stock;
- receção parcial é reconciliada;
- operações repetidas com mesma idempotency key não duplicam.

### Offline

- 8h sem internet;
- múltiplas vendas offline;
- restart do PC;
- fila persiste;
- reconnect sincroniza uma única vez;
- preços cloud atualizam depois do pull;
- conflito não altera documento fiscal já emitido.

### Escala

- 25k produtos;
- 100k movimentos;
- 100k documentos;
- busca < tolerância definida pelo produto;
- nenhuma lista carrega todos os registos no browser.

---

## 17. Recomendação de Produto

A marca deve ser apresentada como:

> **Movax ERP / POS**  
> **O seu negócio, bem gerido.**

Estrutura comercial:

- **Movax Core**
- **Movax Stock**
- **Movax Financeiro**
- **Movax Compras**
- **Movax BI**
- **Movax Multi-Filial**
- **Movax Caixa Pro**
- **Movax Offline**
- **Movax Supermercado**
- **Movax Talho**

O cliente deve ver o seu próprio nome e logo nos documentos e contexto operacional; Movax aparece como plataforma/software.

---

## 18. Estado Final Desta Auditoria

### Corrigido nesta cópia

- marca de plataforma;
- login neutro;
- título/favicon/metadados;
- impressão fiscal sem identidade hardcoded;
- fallbacks bancários específicos removidos;
- notas comerciais de pneus removidas como default global;
- default UUID Casa de Pneus removido do save de configurações do frontend;
- credenciais E2E removidas do código;
- Playwright desacoplado da URL Casa de Pneus;
- documentação principal rebatizada;
- copy residual específica de pneus neutralizada;
- redirect local do Supabase e link do repositório desacoplados da antiga marca.

### Ainda bloqueador

- RLS SaaS completo;
- provisioning de empresas;
- provisioning seguro de utilizadores;
- scripts de build/auditoria ausentes;
- subscriptions/add-ons;
- POS terminals;
- offline sync;
- vertical supermercado;
- vertical talho;
- paginação server-side geral.

### Verificação desta cópia

- Busca por branding Casa de Pneus no código runtime/E2E (excluindo migrations históricas e documentação de planeamento do tenant): **sem ocorrências**.
- Busca por credenciais/URL de produção Casa de Pneus nos ficheiros runtime/E2E: **sem ocorrências**.
- Parsing TypeScript dos ficheiros alterados: **sem erros de sintaxe TS1xxx**.
- Build completo: **não certificado**, porque o pacote recebido não inclui os scripts requeridos e a instalação completa de dependências não pôde ser reproduzida a partir deste pacote isolado.

**READY_FOR_GENERAL_MULTI_TENANT_SAAS: NO**  
**READY_FOR_SECURITY_HARDENING_PHASE: YES**  
**REBRAND_TO_MOVAX_APPLIED_IN_AUDITED_COPY: YES**
