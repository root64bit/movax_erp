# Guia de Desenvolvimento — Movax ERP / POS

## 1. Pré-requisitos
- Node.js 18+ ou 20+
- NPM 9+
- Projeto Supabase ativo (com migrações executadas)

## 2. Configuração de Variáveis de Ambiente
Copie o ficheiro `.env.example` para `.env` (ou `.env.local`):
```bash
cp .env.example .env
```
Preencha:
- `VITE_SUPABASE_URL`: URL do seu projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: Chave anónima pública do Supabase.

## 3. Comandos Principais
- **Desenvolvimento local**: `npm run dev`
- **Compilação de tipos**: `npx tsc --noEmit`
- **Build de produção**: `npm run build`
- **Auditoria de segurança**: `npm run audit:security`
- **Auditoria de dados estáticos**: `npm run audit:static-data`
- **Verificação completa de integridade**: `npm run check`
