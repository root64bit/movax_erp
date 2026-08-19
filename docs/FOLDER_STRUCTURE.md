# Estrutura de Pastas — Movax ERP / POS

```
src/
├── app/                        # Ponto de entrada e infraestrutura da aplicação
│   ├── App.tsx                 # Root component (< 50 linhas)
│   ├── config/                 # Configurações de ambiente e constantes
│   ├── providers/              # Provedores de contexto globais
│   └── router/                 # Roteador, Guards e Rotas Públicas/Privadas
├── features/                   # Módulos de Domínio (Feature-Driven)
│   ├── auth/                   # Autenticação e gestão de sessão
│   ├── dashboard/              # Métricas, KPIs e ações rápidas
│   ├── pos/                    # Ponto de Venda e Caixa Rápido
│   ├── quotations/             # Gestão e emissão de Cotações
│   ├── inventory/              # Catálogo de Produtos e Artigos
│   ├── stock-transfers/        # Guias de Entrada/Saída e Transferências
│   ├── purchases/              # Facturas e Compras a Fornecedores
│   ├── documents/              # Histórico, emissão e anulação de documentos
│   ├── cash/                   # Sessões de Caixa e Contas Correntes
│   ├── customers/              # Clientes, Fornecedores e Avisos Financeiros
│   ├── reports/                # Relatórios Financeiros e Fiscais
│   ├── subscriptions/          # Planos SaaS, Limites e Licenciamento
│   ├── onboarding/             # Provisionamento de novos tenants
│   └── administration/         # Configurações da Empresa e Utilizadores
├── shared/                     # Componentes e utilitários partilhados
│   ├── components/             # UI Components (Button, Input, Modal, Table, Tabs)
│   ├── feedback/               # PageLoader, EmptyState, Feedback banners
│   ├── context/                # OperationalContext (armazém ativo, permissões)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Logger centralizado e telemetria
│   ├── types/                  # Definições canónicas de domínio (domain.types.ts)
│   └── utils/                  # Formatadores (MZN, datas) e helpers de erro
└── integrations/               # Adaptadores externos
    └── supabase/               # Cliente Supabase, mapeamento e helpers RPC
```
