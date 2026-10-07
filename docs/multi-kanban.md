# Múltiplos Kanbans

## Arquitetura e arquivos

`kanbans → kanban_columns → tasks`. Cada tarefa tem `kanban_id` e `column_id` obrigatórios. A FK composta `(column_id, kanban_id)` impede vínculos com uma coluna de outro Kanban. A unicidade da `key` é local ao Kanban. Índices parciais permitem no máximo uma coluna `completed` e uma `blocked` por Kanban.

A migration é `supabase/migrations/20261007000000_multi_kanban.sql`. Ela cria **Principal**, renomeia `boards` preservando UUIDs e configurações, vincula todas as tarefas, recupera status sem coluna e só então aplica `NOT NULL` e FKs. Tarefas arquivadas e relacionamentos com usuários, clientes, comentários, imagens, atividades e notificações permanecem intactos. Tudo ocorre em uma transação; uma inconsistência aborta a operação inteira.

`tasks.status` permanece apenas como espelho de compatibilidade, atualizado por trigger a partir da coluna. O frontend usa exclusivamente IDs, `kind` e `position`. A view `boards` permite leituras legadas das colunas de Principal; administração de colunas exige o novo frontend. Inserts/updates legados de tarefas por `status` continuam sendo traduzidos pelo banco quando o status existe no Kanban correspondente.

Os arquivos da implementação são:

- Modelo, regras e dados: `src/types/index.ts`, `src/lib/kanban.ts`, `src/hooks/usePermissions.ts`, `src/store/useStore.ts`.
- Rotas e seleção: `src/App.tsx`, `src/components/KanbanScope.tsx`, `KanbanSelector.tsx`, `AppLayout.tsx`, `Sidebar.tsx`, `TopHeader.tsx`.
- Quadros e tarefas: `src/pages/Quadro.tsx`, `Tarefas.tsx`, `src/components/KanbanColumn.tsx`, `KanbanCard.tsx`, `TaskModal.tsx`, `FilterBar.tsx`.
- Administração e indicadores: `src/pages/Configuracoes.tsx`, `Relatorios.tsx`, `Equipe.tsx`.
- Validação: `vitest.config.ts`, `playwright.config.ts`, `tests/database.test.ts`, `tests/kanban.test.ts`, `tests/store.test.ts`, `tests/e2e/fixture.ts`, `tests/e2e/kanbans.spec.ts`, scripts/dependências em `package.json` e `package-lock.json`, artefatos ignorados em `.gitignore`.

## Seleção, consultas e comportamento

A rota identifica o Kanban por slug. `/quadro` e slugs desconhecidos redirecionam para o último ID válido escolhido pelo usuário ou o primeiro disponível. A preferência usa o ID, portanto renomear o slug não a invalida. Tarefas, relatórios e configuração também aceitam `/:kanbanSlug`; o seletor mantém a seção quando aplicável. Não existe opção de todos os Kanbans.

`activeKanbanId` é o cache da seleção da rota. Metadados de Kanbans são compartilhados; colunas e tarefas são consultadas com `kanban_id` explícito. Ao trocar, tarefas, colunas, filtros, busca e modal são limpos. A página é remontada para reiniciar paginação e estado local. Versões de requisições descartam respostas e callbacks Realtime antigos, inclusive na sequência A → B → A.

As tarefas são carregadas em lotes de 500 para evitar truncamento pelo limite de respostas do Supabase. Contagens administrativas incluem arquivadas. Atividade recente dos relatórios faz um join filtrado pelo Kanban **antes** de limitar os resultados. As inscrições de INSERT/UPDATE e de colunas usam filtro do Kanban; DELETE usa um listener separado porque PostgreSQL não permite filtrá-lo, e só reage a IDs presentes no escopo atual.

Supervisores administram Kanbans e colunas. Criar um Kanban cria uma primeira coluna normal em uma RPC atômica. Ordenações também usam RPCs atômicas e rejeitam listas duplicadas, incompletas ou desatualizadas. Exclusões são bloqueadas pela interface, por triggers com contagens e por FKs se houver tarefas, inclusive arquivadas. Um Kanban vazio pode ser excluído, inclusive o último; a interface oferece criar outro.

`completed` determina conclusão, atraso, relatórios e arquivamento. Desarquivar mantém os mesmos vínculos. Remover a função de conclusão de uma coluna com tarefas arquivadas é bloqueado. `blocked` determina as restrições de movimentação. Nomes e keys podem variar livremente. Movimentações registram o nome real da coluna na atividade e nas notificações.

Regras de criação equivalentes ao fluxo original: comercial/financeiro usam a primeira coluna normal; técnicos usam a segunda normal ou uma concluída; estagiários usam a segunda normal. Com apenas uma normal, ela também é a coluna de trabalho. Supervisores criam em qualquer coluna. O botão geral oferece a primeira coluna permitida; o modal sem coluna explícita inicia na primeira coluna do Kanban. O botão `+` de uma coluna a seleciona diretamente.

Supervisor geral pode mover em qualquer direção. Adjunto não pode mover para bloqueada. Demais papéis avançam pela ordem das colunas ou saem de uma bloqueada para qualquer coluna do mesmo Kanban. Essas regras também são verificadas pelo banco. Não há ação de transferência entre Kanbans nesta versão.

## Aplicação da migration

1. Faça backup do banco e confira que as migrations anteriores estão aplicadas. Planeje uma janela para o lock de escrita em `boards` e `tasks`; volume grande pode prolongar a migração.
2. Em um ambiente de homologação vinculado ao Supabase, revise e aplique:

   ```bash
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push --dry-run
   npm run db:push
   ```

3. Confira contagens e integridade antes de publicar o frontend:

   ```sql
   select k.slug, count(t.id) as tarefas,
          count(t.id) filter (where t.archived) as arquivadas
   from public.kanbans k left join public.tasks t on t.kanban_id = k.id
   group by k.slug;

   select count(*) as vinculos_invalidos
   from public.tasks t left join public.kanban_columns c
     on c.id = t.column_id and c.kanban_id = t.kanban_id
   where c.id is null;
   ```

4. Publique o frontend novo após a migration. Configure o host para servir `index.html` nas rotas do React Router, inclusive no refresh de `/quadro/<slug>`.

Para uma instalação local nova, com Docker e Supabase CLI disponíveis: `npx supabase start` e `npx supabase db reset`. O reset é apenas para banco local descartável, pois recria seus dados.

**A migration não foi aplicada ao Supabase remoto por esta implementação.** Os testes usam PostgreSQL local descartável, sem credenciais reais. Um rollback após novos dados requer um plano de dados/backup: não renomeie as tabelas de volta descartando os novos Kanbans.

## Validação reproduzível

```bash
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run lint
```

Os testes SQL executam todas as migrations históricas sem alterações e a nova migration em PGlite/PostgreSQL. Apenas os esquemas externos `auth` e `storage` são fixtures. RLS é exercitada com `SET ROLE authenticated`/`anon` e os seis papéis da aplicação; não se usa superusuário para validar as permissões.

Os testes de navegador executam a aplicação e o SDK reais contra respostas HTTP simuladas do Supabase, com usuários e chaves fictícios. Isso verifica fluxos de UI, sem afirmar que um Supabase remoto foi testado. A integração real de Auth/Realtime e o volume de dados de produção devem ser conferidos em homologação antes da implantação.

| Cenários solicitados | Evidência automatizada |
|---|---|
| 1–2: login e Principal | Playwright: autenticação, rota e tarefa antiga |
| 3–4: tarefas e colunas antigas | SQL: snapshots de todos os campos/UUIDs/relacionamentos e instalação nova |
| 5–7: segundo Kanban, colunas e tarefa | SQL e Playwright: criação, tipos personalizados e botão `+` |
| 8–11: isolamento no quadro, tarefas e relatórios | Store, SQL e Playwright: consultas filtradas, atividade e indicadores |
| 12–13: drag local e vínculo estrangeiro proibido | Playwright desktop/toque; store e FK/trigger para vínculos estrangeiros |
| 14–17: Finalizado, Impedido, arquivo e atraso | Regras unitárias, SQL e UI: relatório concluídas/pendentes/atrasadas, arquivo/desarquivo |
| 18–21: filtros, mobile, refresh e slug inválido | Playwright: opções locais, navegação mobile, refresh e fallback |
| 22–23: supervisores e usuário comum | SQL: seis papéis, CRUD direto/RPC, criação/movimento/arquivo; UI: guarda da configuração |
| 24–25: build e lint | Comandos completos, comparação com baseline e lint dos arquivos alterados |

Além disso: slugs com acentos e duplicados, RPC de ordenação inválida, recuperação de colunas removidas, impedimento de exclusão com arquivos, mais de 1.000 tarefas, requisições fora de ordem, busca `#ID`/RFC, paginação após troca e tema claro.

Resultado: **31 testes Vitest e 6 testes Playwright passaram**, incluindo arraste real por toque e exclusão/recriação do último Kanban vazio. O build passa. O lint completo tinha **23 erros e 10 avisos** na base; permanecem **11 erros e 1 aviso**, todos em arquivos não alterados (`src/components/ui/*`, `Clientes.tsx`, `Login.tsx`). A comparação dos diagnósticos não encontrou nenhum novo erro/aviso. Os arquivos alterados e os testes passam no lint. Permanecem avisos de tamanho de bundle/Tailwind já presentes na base.

## Riscos e acompanhamento

O cliente `supabaseAdmin` e `VITE_SUPABASE_SERVICE_ROLE_KEY` já existem no frontend em `src/utils/supabase.ts`. Isso expõe uma credencial que contorna RLS se ela for preenchida no build. A implementação não acrescenta uso desse cliente: toda nova lógica usa `supabase` autenticado. A remoção da chave, rotação das credenciais e transferência da administração de usuários para backend seguro continuam sendo uma correção separada, conforme solicitado.

Como RLS dos Kanbans depende de `public.users.role`, a migration inclui uma proteção pontual: usuários comuns não podem transformar seu próprio perfil em supervisor pela política antiga de edição de perfil. Nome/avatar continuam editáveis e a administração existente pelo backend privilegiado continua funcionando. O restante da autenticação e das políticas de perfis deve ser auditado na correção separada. RLS não oferece proteção contra uma Service Role exposta. A separação entre Kanbans é de fluxo e escopo da interface; todos os usuários autenticados continuam visualizando os Kanbans disponíveis, conforme o requisito, sem um modelo adicional de membros privados por Kanban.

Confirme em homologação o Realtime, a janela de migração e backups. Limites de muitas colunas/alto volume e otimização do bundle são acompanhamentos posteriores. A alteração está na branch `feature/multi-kanban`, para revisão; não exige merge automático em `main`.
