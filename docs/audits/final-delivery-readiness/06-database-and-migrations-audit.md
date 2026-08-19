# Auditoria de Base de Dados e Migrações

## 1. Estado da Base de Dados de Produção
- **Instância**: `bkbcgndzsfylwsinxwbb.supabase.co` (`aws-0-eu-west-1.pooler.supabase.com:6543/postgres`)
- **Modo do Sistema**: `LIVE` (Migrações 022 e 024)
- **Total de Migrações Aplicadas**: 30 ficheiros SQL de migração (de `001` a `032`).

---

## 2. Histórico de Migrações Aplicadas

| Ficheiro de Migração | Função Principal | Estado |
| :--- | :--- | :---: |
| `20260728162000_001_core_schemas_and_company_config.sql` | Esquema base e tabela `companies`. | `APLICADO` |
| `20260728170000_002_auth_rbac_and_rls_foundation.sql` | Tabela `user_profiles`, funções RBAC e RLS. | `APLICADO` |
| `20260728180000_003_articles_and_reference_data.sql` | Catálogo de produtos e impostos. | `APLICADO` |
| `20260728190000_004_stock_engine.sql` | Motor de movimentos e saldos de stock. | `APLICADO` |
| `20260728220000_007_sales_and_purchase_documents.sql` | Facturas, VDs, Guias e linhas de documentos. | `APLICADO` |
| `20260728320000_016_users_dynamic_data_and_mobile_security.sql` | Permissões dinâmicas de utilizadores e auditoria. | `APLICADO` |
| `20260728330000_017_close_profile_direct_write_and_admin_rpc.sql` | Fecho de escrita direta e RPC de perfil. | `APLICADO` |
| `20260731140000_026_stock_extract_and_sales_report_rpcs.sql` | RPCs de extrato de stock e relatório de vendas. | `APLICADO` |
| `20260804230000_032_fix_user_profiles_rls_insert_policy.sql` | Políticas RLS de inserção/eliminação de perfis e acessos. | `APLICADO` |

---

## 3. Verificação de Rollbacks e Scripts
- Scripts de Rollback disponíveis em `supabase/rollbacks/`.
- Todos os ficheiros de migração possuem estrutura SQL idêntica no histórico Git do projeto.
