# Softcom TaskFlow

Sistema interno de gerenciamento de tarefas da Softcom, com suporte a múltiplos setores, controle de prioridades e acompanhamento de atividades em tempo real.

O suporte a múltiplos Kanbans separa quadros, colunas e tarefas por IDs. Consulte [arquitetura, migration, permissões e testes](docs/multi-kanban.md) antes de implantar esta versão. O enum `task_status` abaixo é legado; as colunas atuais usam `kind` e cada tarefa possui `kanban_id`/`column_id`.

## Visão Geral

O TaskFlow permite que equipes dos setores Comercial, Financeiro e Suporte criem, atribuam e acompanhem tarefas em um kanban colaborativo. Cada usuário vê e interage com o sistema de acordo com seu papel (role), com permissões distintas para supervisores, técnicos, estagiários e outros.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS + Radix UI |
| Estado global | Zustand |
| Backend / Banco | Supabase (PostgreSQL) |
| Drag & Drop | dnd-kit |
| Formulários | React Hook Form + Zod |
| Roteamento | React Router v7 |

## Estrutura do Banco de Dados

```
users           — perfis de usuário (espelha auth.users)
tasks           — tarefas com status, prioridade e departamento
comments        — comentários por tarefa (tabela dedicada)
activity_logs   — histórico de ações por tarefa
notifications   — notificações por usuário
```

### Enums definidos no banco

| Enum | Valores |
|---|---|
| `task_priority` | `urgent`, `high`, `medium`, `low` |
| `task_status` | `novo`, `em_andamento`, `em_revisao`, `concluido`, `bloqueado` |
| `user_role` | `supervisor_geral`, `supervisor_adjunto`, `tecnico`, `estagiario`, `comercial`, `financeiro` |
| `department` | `comercial`, `financeiro`, `suporte` |

## Permissões por Role

| Role | Criar | Editar qualquer | Editar própria | Mover | Deletar |
|---|---|---|---|---|---|
| supervisor_geral | ✅ | ✅ | ✅ | ✅ | ✅ |
| supervisor_adjunto | ✅ | ✅ | ✅ | ✅ | ❌ |
| tecnico | ✅ | ❌ | ✅ | ✅ | ❌ |
| estagiario | ✅ | ❌ | ✅ | ❌ | ❌ |
| comercial | ✅ | ❌ | ✅ | ✅ | ❌ |
| financeiro | ✅ | ❌ | ✅ | ✅ | ❌ |

## Estrutura do Projeto

```
src/
├── components/       # Componentes de UI (TaskModal, Kanban, TopHeader, ...)
├── data/             # Mock de usuários (mockData.ts)
├── hooks/            # Hooks customizados (usePermissions, ...)
├── pages/            # Páginas (Login, Dashboard, ...)
├── store/            # Estado global Zustand (useStore.ts)
├── types/            # Interfaces e tipos TypeScript (index.ts)
└── utils/            # Cliente Supabase (supabase.ts)

supabase/
└── migrations/
    ├── 20260429000000_create_base_schema.sql        # Enums + users + tasks
    ├── 20260429003500_add_task_activity_columns.sql # Colunas extras na tasks
    ├── 20260429100000_create_relational_tables.sql  # comments, activity_logs, notifications
    └── 20260429110000_drop_jsonb_columns_from_tasks.sql # Remove JSONB legado
```

## Configuração do Ambiente

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Supabase CLI (instalado via `npx` automaticamente)

### Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha com os valores do seu projeto Supabase:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Os valores estão em: **Supabase Dashboard → Project Settings → API**.

### Instalação

```bash
npm install
```

### Rodar em desenvolvimento

```bash
npm run dev
```

## Banco de Dados

### Aplicar migrations no Supabase remoto

Na primeira vez, autentique o CLI:

```bash
npx supabase login
```

Depois, sempre que houver migrations novas:

```bash
npm run db:push
```

### Aplicar seeders no Supabase remoto

```bash
npx supabase db query --linked --file supabase/(nome_do_seeder).sql
```

### Outros comandos

```bash
npm run db:pull   # Puxa o schema remoto e gera uma nova migration local
npm run db:diff   # Compara o schema local com o remoto e mostra diferenças
```

### Criar uma nova migration

```bash
npx supabase migration new nome_da_migration
```

Isso cria um arquivo vazio em `supabase/migrations/` com o timestamp correto. Escreva o SQL e rode `db:push`.

## Versionamento

A versão do app é controlada em um único lugar:

**`.env`** — fonte de verdade da versão:
```env
VITE_APP_VERSION=1.0.0
```

A versão aparece no rodapé da tela de Login (`Softcom TaskFlow v1.0.0`).

O script `scripts/syncVersion.mjs` lê essa variável e atualiza automaticamente o campo `version` de `package.json` e `package-lock.json` antes de `dev`, `build` e `preview`.

### Convenção de numeração

O projeto segue [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`

| Segmento | Quando incrementar | Exemplo |
|---|---|---|
| `PATCH` | Correção de bug, ajuste visual, texto | `0.0.0` → `0.0.1` |
| `MINOR` | Nova funcionalidade sem quebrar nada existente | `0.0.1` → `0.1.0` |
| `MAJOR` | Mudança que quebra compatibilidade ou reescrita significativa | `0.1.0` → `1.0.0` |

### Como lançar uma nova versão

1. Atualize `VITE_APP_VERSION` no `.env`
2. Rode `npm run sync:version` se quiser sincronizar os metadados sem iniciar o app
3. Crie um commit com a mensagem `chore: bump version to X.Y.Z`
4. Crie uma tag no git:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

### Histórico de versões

| Versão | Data | Descrição |
|---|---|---|
| `0.0.0` | 2026-04-29 | Versão inicial — kanban, autenticação Supabase, perfis por role |

---

## Build

```bash
npm run build
```

O output fica em `dist/` e pode ser servido por qualquer host estático (Vercel, Netlify, etc.).

## Criação de usuários

Para executar `npm run seed:users`, configure `SUPABASE_SERVICE_ROLE_KEY` e `SEED_USERS_PASSWORD` no `.env` local. Não publique esses valores.

## Licença

Este projeto está licenciado sob a [licença MIT](LICENSE).
