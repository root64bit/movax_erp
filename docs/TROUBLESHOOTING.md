# Resolução de Problemas (Troubleshooting)

## 1. Erro de Autenticação / Supabase não configurado
- **Causa**: Variáveis `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` não preenchidas ou incorretas.
- **Solução**: Verifique se o ficheiro `.env` existe na raiz do projeto com as credenciais válidas.

## 2. Documento com Stock Insuficiente
- **Causa**: Tentativa de emissão de factura para produto com stock zero ou negativo sem permissão `stock.negative`.
- **Solução**: Atribuir a permissão ao perfil ou emitir primeiro uma Guia de Entrada de Stock ou Cotação.

## 3. Código de Cliente / Artigo Duplicado
- **Causa**: Violação de unicidade (`code` ou `number` existente no tenant).
- **Solução**: Utilizar códigos únicos por empresa.
