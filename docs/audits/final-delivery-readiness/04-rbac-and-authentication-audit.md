# Auditoria de RBAC e Autenticação

## 1. Matriz de Permissões por Perfil (RBAC)

| Módulo / Funcionalidade | Perfil ADMINISTRATOR | Perfil MANAGER_LIMITED | Validação no Backend |
| :--- | :---: | :---: | :---: |
| **Acesso ao Dashboard** | ✅ Sim | ✅ Sim | `has_permission('dashboard.read')` |
| **Visualizar Produtos** | ✅ Sim | ✅ Sim | `has_permission('products.read')` |
| **Criar/Editar Produtos** | ✅ Sim | ❌ Bloqueado | `has_permission('products.create')` |
| **Visualizar Custo de Compra** | ✅ Sim | ❌ Ocultado (`canViewCost=false`) | `has_permission('products.view_cost')` |
| **Lançar Entradas/Saídas Stock** | ✅ Sim | ✅ Sim | `has_permission('stock.direct_entry')` |
| **Confirmar Facturas/Vendas** | ✅ Sim | ❌ Bloqueado | `has_permission('sales.create')` |
| **Emitir Cotações (0 stock)** | ✅ Sim | ✅ Sim | `has_permission('sales.read')` |
| **Gestão de Utilizadores (Criar/Editar)** | ✅ Sim | ❌ Bloqueado | `has_permission('users.manage')` |
| **Alterar Modo do Sistema** | ❌ Bloqueado | ❌ Bloqueado | Requer `system_mode.manage` (Restrito) |

---

## 2. Validação RLS das Tabelas de Utilizadores e Segurança (Migração 032)
- **Tabela `user_profiles`**: Políticas RLS `user_profiles_select`, `user_profiles_update` e `user_profiles_insert` ativas. A criação de novos utilizadores é gerida através do RPC seguro `admin_create_user_profile` (SECURITY DEFINER) ou por administradores com `users.manage`.
- **Tabelas `user_roles`, `branch_access`, `warehouse_access`**: Privilégios `INSERT` e `DELETE` concedidos ao papel `authenticated` com restrição RLS `public.has_permission('users.manage')`.
