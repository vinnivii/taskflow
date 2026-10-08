# Gerenciamento de status no formulário da tarefa

Branch: `feature/manage-task-statuses`, baseada na `main` com multi-Kanban e melhorias administrativas.

Supervisores geral e adjunto podem usar **Gerenciar status** ao lado de Status no formulário ou nos detalhes da tarefa. No formulário, **+ Novo status** abre diretamente o cadastro. Os status continuam sendo registros de `public.kanban_columns` do Kanban ativo.

## Uso e regras

- Cadastre nome, cor predefinida, hexadecimal ou RGB, função Normal/Concluída/Bloqueada e posição inicial. A chave é gerada a partir do nome e recebe um sufixo quando já existe naquele Kanban.
- Na criação e edição de Kanbans, colunas e status, **Cor RGB** abre o seletor visual do navegador. Os campos **R**, **G** e **B** também permitem informar valores de 0 a 255. Paleta, seletor visual, canais RGB e hexadecimal permanecem sincronizados. Valores RGB fora do intervalo são limitados a 0–255 e decimais são arredondados; apagar um canal permite redigitá-lo, e sair do campo vazio restaura o último valor válido. Um hexadecimal inválido bloqueia salvar e editar os canais até escolher uma cor válida. A cor continua sendo armazenada como `#RRGGBB`.
- Edite nome, cor e função mantendo ID, chave e vínculos das tarefas. O editor informa o impacto de mudanças funcionais em colunas com tarefas e bloqueia funções especiais já existentes. Colunas com tarefas arquivadas mantêm sua função de conclusão.
- Arraste a alça para reorganizar. Também é possível focar a alça, pressionar Espaço, usar as setas e confirmar com Espaço. A ordem usa o RPC transacional existente `reorder_kanban_columns`.
- Excluir abre o `DeleteColumnDialog` já existente. Ele confirma a remoção e permite transferir as tarefas para uma coluna compatível do mesmo Kanban ou excluir permanentemente tarefas e coluna, incluindo arquivadas, pelo RPC administrativo existente.
- Criar, editar ou ordenar um status preserva o título, descrição e demais dados preenchidos. Essas ações não salvam a tarefa nem selecionam automaticamente outro status.
- Se a coluna selecionada de um rascunho novo for removida, escolha outra antes de salvar. Se a tarefa existente for transferida na exclusão da coluna, o formulário adota o destino confirmado e mantém os demais dados do rascunho. Se a tarefa for excluída junto com a coluna, o rascunho permanece visível, com aviso e salvamento bloqueado.
- O editor de colunas é compartilhado com Configurações. Quadro, lista, filtros e relatórios leem nomes, cores, função e posição das mesmas colunas no Zustand. Os subscriptions de Realtime existentes atualizam esses metadados dentro do Kanban ativo.
- Usuários comuns continuam selecionando status conforme as permissões de criação/movimento. Os controles administrativos exigem `canManageKanbans`; o store e as policies RLS revalidam essas operações. Arquivadas só podem ser selecionadas em uma coluna de conclusão.

O cadastro insere a coluna no final e, quando necessário, chama a ordenação existente para aplicar a posição escolhida. Se a ordenação falhar por mudança concorrente ou conexão, o status já criado é preservado e o erro de ordenação é apresentado; reorganize novamente. A criação confirmada não é repetida automaticamente.

## Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/components/kanban/ColumnForm.tsx` | Editor compartilhado, validação de função/cor, posição inicial e avisos de impacto. |
| `src/components/kanban/ColorPicker.tsx` | Paleta, hexadecimal, seletor visual e canais RGB sincronizados, reutilizados também no editor de Kanban. |
| `src/components/kanban/ColumnsManager.tsx` | Lista, contagens com arquivadas, cadastro/edição e reutilização de exclusão. |
| `src/components/kanban/SortableList.tsx` | Ordenação compartilhada, mouse/toque/teclado e bloqueio de requisições duplicadas. |
| `src/components/kanban/StatusManagerDialog.tsx` | Modal Radix, fechamento, bloqueio durante gravação e retorno de foco ao botão de origem. |
| `src/components/TaskModal.tsx` | Controles de gerenciamento, preservação do rascunho e seleção segura após exclusões. |
| `src/pages/Configuracoes.tsx` | Uso do mesmo gerenciador de colunas e seletor de cores. |
| `src/pages/Quadro.tsx` | Nome acessível no botão de criação mobile para a coluna selecionada. |
| `src/lib/kanban.ts` | Chaves únicas por Kanban e rótulos das funções. |
| `src/store/useStore.ts` | Confirmação do cadastro, atualização imediata e posição pelo RPC existente, preservando o escopo. |
| `tests/kanban.test.ts`, `tests/store.test.ts` | Chaves, permissões, metadados, falhas, troca de rota e criação confirmada com falha de ordenação. |
| `tests/admin-database.test.ts` | PostgreSQL real em PGlite: RLS, funções únicas, arquivamento e alterações sem reescrever tarefas. |
| `tests/e2e/statuses.spec.ts`, `tests/e2e/fixture.ts` | Fluxos desktop/mobile, foco, exclusão/transfers, relatórios e protocolo de Realtime simulado. |
| `tests/e2e/colors.spec.ts` | Criação/edição de Kanbans, colunas e status com RGB, persistência hexadecimal, sincronização, limites e layout mobile. |

## Banco e implantação

Não há migration, tabela, RPC, Edge Function ou segredo novo. As constraints, triggers, policies e RPCs das migrations multi-Kanban e administrativa já existentes protegem as operações. Migrations aplicadas permanecem intactas. A implementação e os testes não alteram dados de produção.

Depois de revisar e autorizar o PR, publique o frontend usando as variáveis públicas Supabase do projeto, com o backend administrativo da `main` já implantado. O fluxo de exclusão usa a infraestrutura de limpeza e transações documentada em `admin-management.md`.

## Verificação

Execute `npm test`, `npm run test:e2e`, `npm run build`, `node scripts/checkBrowserSecrets.mjs` e `npm run lint`.

Os testes de banco executam SQL/RLS/FKs em PostgreSQL PGlite local. Os testes Playwright usam HTTP e WebSocket simulados com o SDK Supabase real; conferem INSERT/UPDATE/DELETE de colunas por Realtime sem recarregar a página e sem perder o rascunho. Esses testes não comprovam a entrega de eventos por uma instalação Supabase de produção; os subscriptions e a publicação existentes foram preservados.

O lint dos arquivos alterados deve passar. O lint global mantém os 11 erros e 1 aviso preexistentes em componentes UI, Clientes e Login, descritos em `admin-management.md`. O build mantém os avisos existentes de tamanho do bundle, Browserslist e classes Tailwind.

Resultados desta entrega: **69 testes Vitest e 25 testes Playwright passaram**. Build, lint dos arquivos alterados, `git diff --check` e scanner do bundle sem credenciais administrativas passaram. O lint global falhou somente nos problemas preexistentes descritos acima. As capturas mobile do gerenciador e dos campos RGB foram inspecionadas em 390 × 844.
