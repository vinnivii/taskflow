# Melhorias administrativas

Branch `feature/admin-management-improvements`. A implantação depende da nova migration e das quatro Edge Functions; publicar somente o frontend não habilita essas operações. As migrations anteriores, incluindo `20261007000000_multi_kanban`, permanecem intactas.

## Comportamento e arquivos

- `src/pages/Equipe.tsx` e `src/components/admin/ResetMemberPasswordDialog.tsx`: criar membros e redefinir senhas, somente para supervisor geral. Validação mínima de seis caracteres, confirmação, mostrar/ocultar, processamento e feedback.
- `src/components/TaskModal.tsx`, `src/pages/Tarefas.tsx` e `src/components/admin/{DeleteTaskDialog,TaskActionsMenu}.tsx`: exclusão confirmada de tarefas ativas, concluídas e arquivadas, pelos dois supervisores, no desktop e mobile.
- `src/pages/Configuracoes.tsx` e `src/components/admin/DeleteColumnDialog.tsx`: transferir tarefas ou excluir coluna e tarefas em uma transação. As regras usuais de movimento continuam valendo, inclusive a restrição do adjunto para destinos bloqueados. Como há no máximo uma coluna de conclusão por Kanban, uma coluna com tarefas arquivadas normalmente não tem outro destino compatível nesse mesmo Kanban. A interface informa essa restrição e oferece a exclusão permanente.
- `src/components/admin/DeleteKanbanDialog.tsx`: senha administrativa, contagens que incluem arquivadas, destino, sugestões por nome/função e mapeamento editável de todas as colunas, inclusive vazias. Várias origens podem apontar ao mesmo destino. Tarefas são atualizadas, sem recriação, preservando IDs, arquivamento e relacionamentos.
- `src/store/useStore.ts`, `src/lib/admin-api.ts` e `src/utils/supabase.ts`: cliente público único e ações que confirmam a operação esperada. Não existe cliente Service Role no navegador.

## Banco e autorização

Nova migration: `supabase/migrations/20261008132022_admin_management.sql`.

RPCs `delete_task_with_cleanup` e `delete_column_with_tasks` exigem usuário autenticado e supervisor no banco. A exclusão individual exige o par tarefa/Kanban e retorna exatamente o UUID removido; ausência é erro. Comentários e atividades usam os cascades existentes; notificações permanecem com `task_id = NULL`, conforme a FK existente.

`transfer_delete_kanban` e `reserve_kanban_delete_attempt` têm EXECUTE somente para `service_role`. A Edge Function valida a sessão usando Auth.getUser, lê o papel atual no banco, verifica a senha e chama o RPC com um cliente administrativo sem propagar o JWT do usuário. O banco valida novamente o papel do ator. DELETE direto em Kanbans foi revogado para `anon`/`authenticated`, e a policy antiga foi removida. A criação de perfis via REST também foi bloqueada: o fluxo passa pelo endpoint administrativo, reservado ao supervisor geral.

Os RPCs de exclusão de coluna/Kanban obtêm locks `SHARE ROW EXCLUSIVE` nas tabelas Kanbans, colunas e tarefas até o fim da transação. Isso serializa essas operações administrativas e bloqueia inserts/updates/deletes concorrentes, mantendo leituras disponíveis. São locks globais: operações administrativas grandes podem fazer outras escritas aguardarem. Triggers e FKs continuam ativos. O adjunto pode mapear colunas bloqueadas na transferência integral autorizada pelo backend; suas movimentações usuais e as transferências de uma única coluna continuam seguindo a regra original.

`admin_audit` registra ator, ação, IDs e contagens, sem senhas. `admin_action_limits` aplica atomicamente cinco tentativas por usuário a cada 15 minutos, inclusive tentativas com senha correta. Essas tabelas e a fila de limpeza não têm acesso pelo cliente público. Funções privilegiadas usam `search_path = ''` e privilégios explícitos.

## Edge Functions e segredos

Endpoints: `create-member`, `reset-member-password`, `delete-kanban` e `cleanup-task-storage`. Os três endpoints chamados por usuários mantêm `verify_jwt = true` no gateway e validam explicitamente a identidade em cada handler com Auth.getUser. Somente o worker usa `verify_jwt = false` para permitir o agendamento com seu segredo independente; suas chamadas por usuários também exigem Auth.getUser e papel de supervisor. Uma chave publicável ou um JWT apenas decodificado não autoriza operações. Referência: [headers de autorização](https://supabase.com/docs/guides/functions/auth-headers).

Configure pelo painel Supabase, em Edge Functions → Secrets:

| Segredo | Uso |
| --- | --- |
| `KANBAN_DELETE_PASSWORD` | Senha administrativa definida pelo proprietário, validada exclusivamente no servidor. |
| `TASK_STORAGE_CLEANUP_SECRET` | Segredo independente para o agendamento da limpeza de Storage. |
| `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` | Variáveis fornecidas pelo ambiente das Edge Functions; verificar a disponibilidade no projeto. Não usar prefixo `VITE_`. |

Não copie valores para migrations, README, comandos versionados, logs ou o navegador. Os valores não são fornecidos por este documento. É possível configurar os segredos no painel sem inseri-los no histórico do terminal.

Remova `VITE_SUPABASE_SERVICE_ROLE_KEY` de todos os ambientes do frontend, incluindo Vercel e arquivos locais. **Rotacione a chave administrativa anteriormente exposta**, atualize consumidores legítimos do servidor e retire deployments antigos que ainda incluam o bundle anterior. A remoção de uma variável não invalida uma chave já exposta. O `.env.example` mantém apenas `SUPABASE_SERVICE_ROLE_KEY` para ferramentas locais de servidor, sem valor.

### Senhas e sessões

O reset usa `auth.admin.updateUserById(memberId, { password })` no backend. O perfil público nunca recebe a senha. Regras adicionais de força/vazamento configuradas no Supabase Auth continuam sendo aplicadas; o endpoint apresenta erro controlado. A criação de membro compensa uma falha no perfil removendo o usuário Auth recém-criado; uma falha excepcional nessa compensação registra `member_creation_cleanup_failed` na auditoria para recuperação pelo operador.

No Auth atual, o reset administrativo chama `UpdatePassword` sem um session ID e revoga as sessões/refresh tokens do membro. JWTs já emitidos podem continuar válidos até expirarem: não existe promessa de revogação instantânea do acesso por JWT. O reset já solicita a revogação suportada pelo Auth; não é necessário conhecer ou coletar tokens do membro nem alterar diretamente tabelas gerenciadas de `auth`. Confirme esse comportamento na versão do Auth implantada em staging. Referências: [API administrativa](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [sessões](https://supabase.com/docs/guides/auth/sessions) e [implementação de UpdatePassword](https://github.com/supabase/auth/blob/master/internal/models/user.go).

## Arquivos do Storage

A remoção de arquivos é assíncrona porque Storage e PostgreSQL não compartilham transação. O trigger de exclusão de tarefa grava `task_storage_cleanup` na mesma transação que exclui os dados. Em rollback, a fila e auditoria também voltam ao estado anterior. Imagens do bucket `comment-images` usam `<UUID da tarefa>/<arquivo>`, como o uploader existente. Um novo trigger bloqueia uploads órfãos e usa um lock na tarefa para sincronizar inserts de arquivos com sua exclusão.

O worker reivindica até 20 jobs com lease de cinco minutos e remove arquivos em lotes de 100, até 50 lotes por execução/job. Jobs ficam elegíveis após um minuto; falhas permanecem na fila e são retomadas depois do lease. O worker verifica se a tarefa foi restaurada antes de apagar arquivos. Não segue URLs externas nem remove avatares ou arquivos de outras tarefas. URLs externas nos comentários não pertencem ao Storage do projeto e permanecem fora dessa limpeza.

**Agende `cleanup-task-storage` a cada cinco minutos** com POST e header `x-cleanup-secret`, fornecendo `TASK_STORAGE_CLEANUP_SECRET` por um gerenciador de segredos. Pode usar Supabase Cron + pg_net + Vault ou um scheduler externo que mantenha o segredo no servidor. Use a URL `https://<project-ref>.supabase.co/functions/v1/cleanup-task-storage`; não coloque o valor em código SQL versionado ou em um scheduler público. O endpoint também permite uma chamada autenticada de supervisor para tentar antecipar jobs já elegíveis. A chamada imediata após uma exclusão não substitui o agendamento, devido ao atraso inicial de um minuto.

O repositório inclui `.github/workflows/cleanup-task-storage.yml`, com execução manual e agendamento a cada cinco minutos. Configure a variável de Actions `TASK_STORAGE_CLEANUP_URL` com a URL do endpoint e o segredo de Actions `TASK_STORAGE_CLEANUP_SECRET` com o mesmo valor privado configurado no Supabase. O workflow não precisa de checkout nem de permissões do token GitHub. Ative-o na branch padrão e execute-o manualmente para verificar a implantação.

O agendamento de Actions pode sofrer atrasos. Em repositórios públicos, o GitHub desativa workflows agendados após 60 dias sem atividade; monitore suas execuções e reative o workflow quando necessário, ou migre o agendamento para Supabase Cron. Referência: [agendamentos do GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Para verificar pendências no SQL Editor administrativo:

```sql
SELECT task_id, created_at, available_at, lease_until, attempts
FROM public.task_storage_cleanup ORDER BY created_at;
SELECT actor_id, action, details, created_at
FROM public.admin_audit ORDER BY id DESC LIMIT 50;
```

## Implantação para revisão do proprietário

1. Revise o PR, a migration e as permissões; prepare backup e use primeiro um projeto Supabase de teste. Nenhuma alteração de banco ou exclusão foi executada na produção durante o desenvolvimento.
2. Configure os segredos privados e a rotação da chave exposta. Configure no frontend apenas a URL Supabase e a chave publicável, além das variáveis de apresentação já existentes.
3. Execute `npx supabase link --project-ref <staging-ref>` e revise `npx supabase db push --dry-run`. A migration nova depende da migration multi-Kanban já aplicada. Execute também `npx supabase db advisors --linked --type security --fail-on error` no projeto de teste após aplicar as mudanças.
4. Aplique `npx supabase db push` no projeto de teste. Não use reset de banco ou reaplique migrations históricas em produção.
5. Publique as funções:

```powershell
npx supabase functions deploy create-member --project-ref <staging-ref>
npx supabase functions deploy reset-member-password --project-ref <staging-ref>
npx supabase functions deploy delete-kanban --project-ref <staging-ref>
npx supabase functions deploy cleanup-task-storage --project-ref <staging-ref>
```

6. Configure o agendamento de limpeza e publique o frontend de teste com as variáveis públicas do mesmo projeto.
7. Em staging, crie um membro descartável, redefina sua senha e faça login com a nova; confirme que a antiga falha e confira a renovação de uma sessão anterior. Teste os dois supervisores e um usuário comum. Teste imagens reais, execução do worker e fila vazia após limpeza. Faça duas escritas concorrentes durante uma transferência e confira a serialização.
8. Valide exclusão individual, cancelamento, arquivos, exclusão de coluna, transferências com arquivadas, senha incorreta/correta, mapeamentos, IDs/relacionamentos, demais Kanbans, realtime, relatórios, notificações, desktop e mobile. Os testes automatizados são descritos abaixo.
9. Após aprovação do proprietário, repita o processo no projeto de produção, migration e funções antes do frontend. Faça merge/publicação somente com essa autorização.

Um rollback somente do frontend não restaura registros apagados e não deve reabrir a policy de exclusão de Kanban ou recolocar credenciais no cliente. Mantenha o bloqueio seguro e corrija ou reverta o código afetado conforme a falha observada.

## Validação automatizada

```powershell
npm test
npm run test:e2e
npm run build
node scripts/checkBrowserSecrets.mjs
npm run lint
npx --yes --package=deno deno check supabase/functions/create-member/index.ts supabase/functions/reset-member-password/index.ts supabase/functions/delete-kanban/index.ts supabase/functions/cleanup-task-storage/index.ts
```

`tests/admin-database.test.ts` executa toda a cadeia de migrations em PostgreSQL PGlite e valida permissões, FKs, identidade/relacionamentos, arquivadas, auditoria, fila, locks e rollback de falhas induzidas. `tests/admin-functions.test.ts` usa o SDK Supabase real com servidor HTTP simulado para contratos de Auth, autorização, validação, criação compensada, login com senha nova/antiga, password gate e retries de Storage. `tests/store.test.ts` inclui confirmação do ID removido e rejeição de requisições duplicadas. `tests/e2e/admin.spec.ts` testa fluxos da interface no Chromium usando a fixture HTTP local; regressões multi-Kanban continuam em `kanbans.spec.ts`.

Esses testes não se conectam à produção. Auth/Storage reais e duas conexões PostgreSQL simultâneas precisam da verificação em staging descrita acima: neste ambiente não há Docker/Supabase local completo. A inspeção dos locks é automatizada, mas não representa um teste concorrente com duas conexões reais. `supabase db advisors --local` também foi tentado e não conseguiu conectar a um servidor local; execute os advisors em staging antes do deploy.

O lint dos arquivos alterados deve passar. O lint global possui 11 erros e 1 aviso preexistentes em componentes `src/components/ui/{badge,button-group,button,form,navigation-menu,sidebar,toggle}.tsx`, `src/pages/Clientes.tsx` e `src/pages/Login.tsx`, sem alterações neste PR. O build mantém avisos preexistentes de tamanho do bundle e classes Tailwind.

Resultados executados nesta entrega: **60 testes Vitest e 12 testes Playwright passaram**; build, checagem TypeScript/Deno das quatro funções, lint dos arquivos alterados e verificação do bundle sem credenciais administrativas passaram. O lint global falhou somente nos problemas preexistentes descritos acima.
