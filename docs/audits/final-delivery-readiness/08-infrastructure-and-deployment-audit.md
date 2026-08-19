# Auditoria de Infraestrutura e Deployment

## 1. Registo de Publicação e Deployment
- **Plataforma de Alojamento**: Vercel (Edge Network)
- **URL Principal de Produção**: [https://casadepeneus-seven.vercel.app](https://casadepeneus-seven.vercel.app)
- **Alias Secundário**: `https://casadepeneus-bqcrr087z-mm-global-techno-solutions-projects.vercel.app`
- **Estado do Deployment**: `READY` (Concluído em 24s na região Washington, D.C., USA - `iad1`).
- **Commit Publicado**: `07aac38475c75b33ea9fe35ac0f76f99f5ad97cd` (`07aac38`)
- **SSL / HTTPS**: Certificado wildcard Vercel ativo com HTTP Strict Transport Security (HSTS).

---

## 2. Configurações de Compilação em Nuvem
- **Build Command**: `node scripts/clean_sites_build.js && tsc && vite build && node scripts/prepare_sites_build.js`
- **Output Directory**: `dist/client`
- **Node.js Runtime**: `20.x` / `24.x`
- **Cache de Restauração**: Restabelecido com sucesso em cada pipeline de integração contínua.

---

## 3. Isolamento entre Ambientes
- O ambiente de produção aponta exclusivamente para a instância oficial da base de dados Supabase da Casa de Pneus (`bkbcgndzsfylwsinxwbb`).
- Nenhuma base de dados secundária ou ambiente de testes local interfere com o tráfego da aplicação em nuvem.
