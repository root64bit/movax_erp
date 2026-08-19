# Arquitetura do Movax ERP / POS

## 1. Visão Geral
O **Movax ERP / POS** é uma plataforma SaaS Multi-Empresa, Multi-Sucursal e Multi-Armazém desenhada especificamente para o mercado moçambicano (MZN, IVA 16%, conformidade fiscal e operacional).

## 2. Princípios Arquiteturais (Clean Architecture & Feature-Driven)

1. **Separação Rígida em 3 Camadas:**
   - **Camada de Apresentação (UI / React)**: Componentes React desacoplados de chamadas Supabase ou queries SQL diretas.
   - **Camada de Aplicação e Serviços de Domínio (`src/features/*/services`)**: Encapsula regras de negócio, validações e comunicação com o backend/RPCs.
   - **Camada de Infraestrutura e Integração (`src/integrations/supabase`)**: Cliente Supabase centralizado, sanitização de erros e helpers de parsing tipados.

2. **Hierarquia de Ficheiros e Escopo (`App.tsx` enxuto < 50 linhas):**
   - `App.tsx` apenas inicializa os Providers globais (`AppProviders`) e delega para o roteador (`AppRouter`).
   - Roteamento modularizado em `PublicRoutes` e `PrivateRoutes`, com proteções (`AuthGuard`, `PermissionGuard`, `FeatureGuard`, `SubscriptionGuard`).

3. **Multi-Tenancy e Isolamento de Dados:**
   - Isolamento a nível de base de dados via Row Level Security (RLS) associado a `company_id` e escopo operacional (`branch_id`, `warehouse_id`, `pos_terminal_id`).
   - Funções transacionais executadas via RPCs PostgreSQL seguros (`SECURITY DEFINER`), garantindo atomicidade e idempotência.

4. **Moeda e Neutralidade:**
   - Moeda padrão: Meticais Moçambicanos (**MZN**).
   - Formatação consistente via `formatMZN()` em `src/shared/utils/formatters.ts`.
