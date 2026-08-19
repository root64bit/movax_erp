# Auditoria de Segurança, Credenciais e Dependências

## 1. Verificação de Segredos no Repositório e Bundles Client-Side

### 1.1 Ficheiro `.env` e Controlo Git
- `.env` está devidamente listado em `.gitignore`.
- Ficheiros de segredos e credenciais de base de dados não se encontram versionados no repositório público ou em instâncias do cliente.

### 1.2 Auditoria do Bundle de Produção Client-Side
- Inspecionado o bundle JavaScript estático gerado em `dist/client/assets/index-D8YrSJeo.js`.
- **Resultado**: Nenhuma `service_role` key ou chave privada master do Supabase foi incluída no bundle do navegador. Apenas a chave pública publicável `VITE_SUPABASE_ANON_KEY` está presente.

---

## 2. Auditoria Estática de Segurança (Script `npm run audit:security`)

```text
$ node scripts/audit-repository-security.js
Repository security audit: PASS
```

- **Passing Checks**:
  - Sem passwords ou chaves em texto claro no código-fonte em `src/`.
  - Sem desativação da autenticação (`DISABLE_AUTH` ou `SKIP_AUTH`).
  - Sem injeção de parâmetros dinâmicos vulneráveis a SQL Injection.

---

## 3. Auditoria de Dependências (`npm audit`)
- **Vulnerabilidades Críticas**: `0`
- **Vulnerabilidades de Alta Severidade**: `0`
- As dependências de produção (`@supabase/supabase-js`, `react`, `react-dom`, `vite`) estão atualizadas e limpas.
