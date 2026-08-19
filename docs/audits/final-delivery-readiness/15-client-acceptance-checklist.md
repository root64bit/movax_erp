# Lista de Verificação e Aceitação do Cliente (Client Acceptance Checklist)

- [x] **Repositório e Commit Auditado**: Confirmado commit `07aac38` na branch `codex/wp11-application-completion`.
- [x] **Deployment em Produção**: Publicado em Vercel [https://casadepeneus-seven.vercel.app](https://casadepeneus-seven.vercel.app).
- [x] **Compilação e Tipagem**: `npx tsc --noEmit` executado com 0 erros; `npm run build` gerado sem falhas.
- [x] **Autenticação e RBAC**: Perfis de Administrador e Gestor com RLS ativo e permissões validadas.
- [x] **Modo de Cotação**: Cotação emite documentos com 0 dedução de stock e surge instantaneamente no histórico.
- [x] **Navegação Ultra-Rápida**: Navegação por `Enter` no ecrã de Cotação e atalho `F2` funcionais.
- [x] **Filtro Exato de Código de Artigo**: Pesquisa por código numérico como `1` exibe exclusivamente o artigo `1`.
- [x] **Relatórios com Coluna PVR**: Fórmula `[PVP × (1 + Margem%) / (1 + IVA%)]` com alternador de visibilidade e exportação CSV.
- [x] **Impressão Oficial de Fatura/Cotação**: Impressão limpa sem logotipos nem carimbos "PAGO", com contas bancárias e extenso MZN.
- [x] **Correção RLS Utilizadores**: Migração `032` aplicada resolvendo erros de criação de perfis em `user_profiles`.
- [ ] **Validação em Impressora Física de Balcão**: Pendente de teste presencial pelo cliente durante o piloto.
- [ ] **Migração Definitiva do XT-POS**: Pendente de contagem física de stock e termo de reconciliação assinado.
- [ ] **Aprovação Final do Piloto de 14 Dias**: Pendente de conclusão do período experimental.

---

**Assinaturas de Entrega para Piloto Controlado**:

_______________________________________________  
**Responsável Técnico / Auditor Audit**  

_______________________________________________  
**Representante da Gerência — Casa de Pneus**  
