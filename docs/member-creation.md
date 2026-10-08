# Cadastro administrativo de membros

Branch: `fix/simplified-member-creation`, baseada na `main` após o PR de status e cores RGB.

## Diagnóstico

Os logs de produção consultados em 08/10/2026 mostram tentativas de `create-member` às 18:39, 18:40 e 18:46 UTC retornando HTTP 400. Nos mesmos horários, o Auth respondeu `/admin/users` com HTTP 422 e código **`email_exists`**. Algumas dessas chamadas ocorreram segundos após respostas 200 de cadastro. A função substituía essa causa pela mensagem genérica sobre e-mail/senha.

A leitura do banco encontrou 5 contas no Auth e 3 perfis na equipe, com 2 contas sem perfil, nenhuma conta sem confirmação e nenhum perfil sem conta. Esses números são uma fotografia do diagnóstico; não provam a origem das contas sem perfil. Nenhuma conta preexistente foi alterada ou removida. Não há trigger de criação de perfil em `auth.users`; o perfil continua sendo responsabilidade da Edge Function. A foreign key `public.users.id -> auth.users.id ON DELETE CASCADE` permanece intacta.

A configuração do Auth foi consultada pela Management API: `password_min_length = 6`, sem `password_required_characters`, e `password_hibp_enabled = false`. A confirmação de cadastro público permanece habilitada (`mailer_autoconfirm = false`). O cadastro administrativo usa `auth.admin.createUser({ email_confirm: true })`, que permite login imediato e não envia convite ou ativação. As políticas e o login existentes não foram modificados.

Referências oficiais: [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [códigos de erro do Auth](https://supabase.com/docs/guides/auth/debugging/error-codes), [política de senhas](https://supabase.com/docs/guides/auth/password-security) e [consulta da configuração](https://supabase.com/docs/reference/api/v1-get-auth-service-config).

## Comportamento

- O supervisor geral informa nome, e-mail, senha inicial e cargo. O departamento é calculado no servidor a partir do cargo. Clientes antigos que ainda enviam departamento devem enviar um valor compatível.
- Nome é aparado; e-mail é aparado e convertido para minúsculas. Senhas mantêm seu conteúdo exato, com 6–1024 caracteres, e continuam sujeitas à política efetiva do Auth. Não se salva senha em `public.users`.
- O servidor valida a sessão com `getUser`, consulta o cargo atual em `public.users`, cria a conta no Auth com e-mail confirmado, insere e confirma o perfil com o mesmo UUID, verifica a gravação da auditoria e retorna somente os dados públicos do membro.
- E-mail duplicado retorna 409 com mensagem clara, inclusive quando existe apenas no Auth. Uma tentativa repetida não recria nem remove uma conta anterior. As duas contas sem perfil encontradas no diagnóstico exigem revisão administrativa separada; o cadastro não tenta repará-las automaticamente.
- Senha fraca, e-mail inválido, limitação de tentativas, serviço indisponível e falha de perfil têm mensagens distintas. Logs do servidor contêm etapa, código e status, sem mensagens internas completas, e-mails, senhas, tokens ou chaves.
- Falha na criação do perfil ou na auditoria causa compensação exclusivamente da conta criada pela solicitação atual. A exclusão dessa conta também remove seu perfil pela foreign key. Se a compensação falhar, há um registro de auditoria e aviso de cadastro incompleto para revisão; não se declara sucesso nem se repete a operação automaticamente.
- O formulário bloqueia entradas, fechamento e submissões repetidas durante a gravação. Após sucesso, informa que o membro pode acessar imediatamente, limpa o formulário e atualiza a equipe. O perfil confirmado permanece visível mesmo se a atualização da lista falhar.
- A redefinição de senha continua usando `updateUserById`, com o mesmo tratamento seguro de falhas do Auth. O login continua usando `signInWithPassword`; contas e senhas antigas são preservadas.

## Arquivos

| Arquivo | Alteração |
| --- | --- |
| `supabase/functions/_shared/admin.ts` | Normalização, departamento automático, erros seguros, confirmação de perfil/auditoria e compensação. |
| `src/pages/Equipe.tsx` | Quatro campos, validação, acessibilidade, bloqueio de repetição e mensagem de acesso imediato. |
| `src/store/useStore.ts` | Cadastro sem departamento obrigatório e atualização a partir do perfil confirmado. |
| `tests/admin-functions.test.ts`, `tests/store.test.ts` | Contratos HTTP do SDK, seis cargos, falhas, compensação, duplicidade e atualização da lista. |
| `tests/e2e/members.spec.ts`, `tests/e2e/fixture.ts` | Interface desktop/mobile, dados enviados, mensagens e submissões simultâneas. |
| `tests/integration/members.ts` | Verificação com Auth, PostgREST e Postgres reais em Supabase local isolado. |
| `.github/workflows/member-auth-integration.yml` | CI sem credenciais de produção: aplica migrations existentes e executa os testes reais de Auth. |

## Verificação e implantação

Execute `npm test`, `npm run test:e2e`, `npm run build`, o lint dos arquivos alterados e `node scripts/checkBrowserSecrets.mjs`. As quatro Edge Functions passam por `deno check`.

O workflow de integração usa Supabase local em um runner Linux, com todas as migrations existentes, contas de teste, SMTP local e nenhuma chave de produção. O script recusa URLs fora de localhost. Verifica os seis cargos, existência no Auth e no perfil, confirmação de e-mail, login imediato, contas antigas do ambiente de teste, duplicidade inclusive de conta sem perfil, dados inválidos, permissões, redefinição e compensação por falha real de constraint. Ao terminar, remove apenas suas próprias contas de teste. A máquina de desenvolvimento não dispõe de Docker; a integração real é executada pelo CI. Os testes de interface usam HTTP simulado; os testes de banco Vitest usam PostgreSQL PGlite.

Não há migration nova. Para aplicar a correção em produção, após aprovação do PR, publique o frontend e faça redeploy de **`create-member` e `reset-member-password`**, pois ambas usam o handler compartilhado alterado. Preserve `verify_jwt = true` e a Service Role exclusivamente no servidor. Não é necessário redeploy das funções de Kanban/limpeza para esta correção.

```powershell
npx supabase functions deploy create-member --project-ref <projeto-aprovado>
npx supabase functions deploy reset-member-password --project-ref <projeto-aprovado>
```

O lint global mantém os 11 erros e 1 aviso preexistentes em componentes UI, Clientes e Login. O build mantém os avisos existentes de bundle, Browserslist e classes Tailwind.
