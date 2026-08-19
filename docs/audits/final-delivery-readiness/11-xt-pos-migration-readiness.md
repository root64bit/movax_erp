# Prontidão da Migração de Dados do XT-POS

## 1. Estado Atual da Importação do Sistema Legado
- **Classificação**: `NÃO EXECUTADO / PENDENTE DE VALIDAÇÃO DO CLIENTE`
- **Motivo**: Em estrito cumprimento das regras operacionais, os dados do sistema legado XT-POS **não foram importados cegamente para a base de dados de produção ao vivo**, para evitar a poluição do catálogo e saldos com registos duplicados ou desatualizados antes da aprovação explícita.

---

## 2. Tabelas e Motores Preparados em Migrações
As seguintes tabelas staging e procedimentos de migração estão codificados e preparados:
- `20260728200000_005_legacy_article_and_stock_migration_staging.sql`
- `20260728210000_006_customers_suppliers_and_contact_migration.sql`
- `20260728260000_009_legacy_raw_staging_completion.sql`
- `20260728270000_010_legacy_transformation_and_mapping_engine.sql`

---

## 3. Requisitos Obrigatórios Antes da Importação Final:
1. Exportação em formato CSV/Excel limpo do catálogo XT-POS atualizado.
2. Contagem física manual do stock em loja para reconciliação dos saldos.
3. Assinatura do **Termo de Reconciliação e Transição de Dados Legados** pela gerência da Casa de Pneus.
