# Auditoria de Backup, Recuperação e Continuidade de Negócio

## 1. Política de Backup Automático da Base de Dados
- **Serviço**: Supabase Automated Point-in-Time Recovery (PITR) & Daily Backups.
- **Frequência**: Diária (com retenção de 7 dias no plano oficial Supabase Pro/Enterprise).
- **Localização dos Dumps de Segurança**: Datacenter AWS Frankfurt / Europe (eu-west-1).
- **Script de Backup de Pré-Deploy**: Criado e validado em `scripts/create_wp11_pre012_backup.js`.

---

## 2. Procedimento de Restauração e Rollback

```text
RPO (Recovery Point Objective): < 24 Horas
RTO (Recovery Time Objective): < 1 Hora
```

### Passos para Restauração em Caso de Emergência:
1. Identificar a falha crítica no painel de auditoria `audit.operational_events`.
2. Executar o rollback do deployment na plataforma Vercel promovendo o commit anterior estável.
3. Se houver corrupção de base de dados, aplicar os ficheiros SQL de rollback localizados em `supabase/rollbacks/` ou efetuar o restauro de PITR no painel Supabase.
