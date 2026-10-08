import { test, expect, type Page } from "@playwright/test";
import { login, mockSupabase } from "./fixture";

const manager = (page: Page) => page.getByRole("dialog", { name: "Gerenciar status", exact: true });
const taskForm = (page: Page) => page.getByRole("dialog", { name: "Nova tarefa", exact: true });
async function openNewTask(page: Page) {
  await page.getByRole("button", { name: "Nova tarefa em Novo", exact: true }).click();
}

test("create a colored status at a chosen position, preserve the new-task draft and reuse it throughout the Kanban", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page); await openNewTask(page);
  const form = taskForm(page);
  await form.getByPlaceholder("Titulo da tarefa...").fill("Rascunho preservado");
  await form.getByPlaceholder("Descreva a tarefa...").fill("Descrição não deve ser salva automaticamente");
  await form.getByRole("button", { name: "Novo status", exact: true }).click();
  const dialog = manager(page);
  await dialog.getByLabel("Nome do status").fill("Aguardando cliente");
  await dialog.getByLabel("Cor personalizada").fill("#8844CC");
  await dialog.getByLabel("Posição na sequência").selectOption("1");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByLabel("Editar Aguardando cliente", { exact: true })).toBeEnabled();
  const created = mock.tables.kanban_columns.find((row) => row.name === "Aguardando cliente")!;
  expect(created).toMatchObject({ kanban_id: mock.principal.id, key: "aguardando-cliente", color: "#8844CC", kind: "normal", position: 1 });
  expect(mock.tables.tasks).toHaveLength(3);
  await dialog.getByRole("button", { name: "Fechar gerenciamento" }).click();
  await expect(form.getByPlaceholder("Titulo da tarefa...")).toHaveValue("Rascunho preservado");
  await expect(form.getByPlaceholder("Descreva a tarefa...")).toHaveValue("Descrição não deve ser salva automaticamente");
  await expect(form.getByRole("button", { name: "Novo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await form.getByRole("button", { name: "Aguardando cliente", exact: true }).click();
  await form.getByRole("button", { name: "Criar Tarefa →" }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nova tarefa em Aguardando cliente", exact: true })).toBeVisible();
  expect(mock.tables.tasks.find((task) => task.title === "Rascunho preservado")?.column_id).toBe(created.id);
  expect(mock.tables.kanban_columns.filter((row) => row.kanban_id === mock.development.id)).toHaveLength(3);
  await page.goto("/tarefas/principal");
  await expect(page.getByLabel("Filtrar coluna").locator("option")).toHaveText(["Status", "Novo", "Aguardando cliente", "Em Andamento", "Concluído"]);
  await page.goto("/configuracoes/principal");
  await page.getByLabel("Editar Aguardando cliente", { exact: true }).click();
  await expect(page.getByLabel("Nome da coluna", { exact: true })).toHaveValue("Aguardando cliente");
  await expect(page.getByLabel("Cor personalizada")).toHaveValue("#8844CC");
});

test("rename, recolor, change kind and drag statuses without changing task IDs, keys or unsaved edits", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page);
  await page.getByText("Tarefa antiga Principal", { exact: true }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByPlaceholder("Titulo da tarefa...").fill("Edição preservada");
  const originalTasks = structuredClone(mock.tables.tasks);
  await page.getByRole("button", { name: "Gerenciar status", exact: true }).click();
  const dialog = manager(page);
  await dialog.getByLabel("Editar Em Andamento", { exact: true }).click();
  await dialog.getByLabel("Nome do status").fill("Em desenvolvimento");
  await dialog.getByLabel("Cor personalizada").fill("#XYZXYZ");
  await expect(dialog.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
  await dialog.getByLabel("Cor personalizada").fill("#AABBCC");
  await dialog.getByLabel("Tipo funcional").selectOption("blocked");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByLabel("Editar Em desenvolvimento", { exact: true })).toBeEnabled();
  expect(mock.tables.kanban_columns.find((column) => column.id === mock.work.id)).toMatchObject({ key: "em_andamento", name: "Em desenvolvimento", color: "#AABBCC", kind: "blocked" });
  expect(mock.tables.tasks).toEqual(originalTasks);
  const start = await dialog.getByLabel("Reordenar Em desenvolvimento", { exact: true }).boundingBox();
  const end = await dialog.getByLabel("Reordenar Novo", { exact: true }).boundingBox();
  expect(start && end).toBeTruthy();
  await page.mouse.move(start!.x + 8, start!.y + 8); await page.mouse.down();
  await page.mouse.move(end!.x + 8, end!.y + 8, { steps: 15 }); await page.mouse.up();
  await expect.poll(() => mock.tables.kanban_columns.find((column) => column.id === mock.work.id)?.position).toBe(0);
  await dialog.getByRole("button", { name: "Fechar gerenciamento" }).click();
  await expect(page.getByRole("button", { name: "Gerenciar status", exact: true })).toBeFocused();
  await expect(page.getByPlaceholder("Titulo da tarefa...")).toHaveValue("Edição preservada");
  await expect(page.getByRole("button", { name: "Novo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true })).toHaveCount(0);
  expect(mock.tables.tasks.find((task) => task.id_task === 1)).toMatchObject({ title: "Edição preservada", column_id: mock.initial.id });
});

test("delete an empty selected status with confirmation, keep the creation draft and require another selection", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page); await openNewTask(page);
  await taskForm(page).getByPlaceholder("Titulo da tarefa...").fill("Novo rascunho");
  await taskForm(page).getByRole("button", { name: "Em Andamento", exact: true }).click();
  await taskForm(page).getByRole("button", { name: "Gerenciar status", exact: true }).click();
  await manager(page).getByLabel("Excluir Em Andamento", { exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "Excluir coluna", exact: true });
  await deletion.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(manager(page)).toBeVisible();
  expect(mock.tables.kanban_columns.some((column) => column.id === mock.work.id)).toBe(true);
  await manager(page).getByLabel("Excluir Em Andamento", { exact: true }).click();
  await deletion.getByRole("button", { name: "Excluir coluna e tarefas", exact: true }).click();
  await expect(deletion).toHaveCount(0); await expect(manager(page)).toBeVisible();
  await manager(page).getByRole("button", { name: "Fechar gerenciamento" }).click();
  await expect(taskForm(page).getByPlaceholder("Titulo da tarefa...")).toHaveValue("Novo rascunho");
  await expect(taskForm(page).getByRole("button", { name: "Criar Tarefa →" })).toBeDisabled();
  await expect(taskForm(page)).toContainText("Escolha outro status antes de salvar");
  await taskForm(page).getByRole("button", { name: "Novo", exact: true }).click();
  await taskForm(page).getByRole("button", { name: "Criar Tarefa →" }).click();
  await expect(taskForm(page)).toHaveCount(0); expect(mock.tables.tasks).toHaveLength(4);
});

test("transfer tasks when deleting their status, preserve the edit draft and save into the confirmed destination", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page);
  await page.getByText("Tarefa antiga Principal", { exact: true }).click(); await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByPlaceholder("Titulo da tarefa...").fill("Título ainda não salvo");
  await page.getByRole("button", { name: "Gerenciar status", exact: true }).click();
  await manager(page).getByLabel("Excluir Novo", { exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "Excluir coluna", exact: true });
  await deletion.getByLabel("Coluna de destino").selectOption(mock.work.id as string);
  await deletion.getByRole("button", { name: "Transferir e excluir coluna" }).click();
  await expect(deletion).toHaveCount(0); await manager(page).getByRole("button", { name: "Fechar gerenciamento" }).click();
  await expect(page.getByPlaceholder("Titulo da tarefa...")).toHaveValue("Título ainda não salvo");
  await expect(page.getByRole("button", { name: "Em Andamento", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(mock.tables.tasks.find((task) => task.id_task === 1)).toMatchObject({ title: "Tarefa antiga Principal", column_id: mock.work.id });
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Detalhes da tarefa", exact: true })).toHaveCount(0);
  expect(mock.tables.tasks.find((task) => task.id_task === 1)).toMatchObject({ title: "Título ainda não salvo", column_id: mock.work.id });
});

test("archived task compatibility, duplicate functional kinds and unique scoped keys", async ({ page }) => {
  const mock = await mockSupabase(page); mock.tables.tasks.find((task) => task.id_task === 3)!.archived = true;
  await login(page); await page.goto("/tarefas/desenvolvimento");
  await page.getByText("Entrega finalizada", { exact: true }).click(); await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Aberto", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Gerenciar status", exact: true }).click();
  await manager(page).getByLabel("Editar Finalizado", { exact: true }).click();
  await expect(manager(page).getByLabel("Tipo funcional").locator('option[value="normal"]')).toHaveAttribute("disabled", "");
  await expect(manager(page)).toContainText("1 tarefa(s) arquivada(s)");
  await manager(page).getByLabel("Nome do status").fill("Entregue");
  await manager(page).getByRole("button", { name: "Cor #A855F7", exact: true }).click();
  await manager(page).getByRole("button", { name: "Salvar", exact: true }).click();
  await manager(page).getByRole("button", { name: "Novo status", exact: true }).click();
  await expect(manager(page).getByLabel("Tipo funcional").locator('option[value="completed"]')).toHaveAttribute("disabled", "");
  await expect(manager(page).getByLabel("Tipo funcional").locator('option[value="blocked"]')).toHaveAttribute("disabled", "");
  await manager(page).getByLabel("Nome do status").fill("Aberto");
  await manager(page).getByRole("button", { name: "Salvar", exact: true }).click();
  await expect.poll(() => mock.tables.kanban_columns.some((column) => column.key === "aberto-2" && column.kanban_id === mock.development.id)).toBe(true);
  await manager(page).getByRole("button", { name: "Fechar gerenciamento" }).click();
  await expect(page.getByRole("button", { name: "Entregue", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(mock.tables.tasks.find((task) => task.id_task === 3)?.archived).toBe(true);
});

test("mobile status manager, keyboard ordering, escape and preserved draft for deputy supervisor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await mockSupabase(page, "supervisor_adjunto"); await login(page); await openNewTask(page);
  await taskForm(page).getByPlaceholder("Titulo da tarefa...").fill("Rascunho mobile");
  await taskForm(page).getByRole("button", { name: "Gerenciar status", exact: true }).click();
  const handle = manager(page).getByLabel("Reordenar Novo", { exact: true });
  await handle.focus(); await expect(handle).toBeFocused(); await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  const startY = (await handle.boundingBox())!.y;
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => (await handle.boundingBox())!.y).toBeGreaterThan(startY + 20);
  await page.keyboard.press("Space");
  await expect.poll(() => mock.tables.kanban_columns.find((column) => column.id === mock.initial.id)?.position).toBe(1);
  await manager(page).getByRole("button", { name: "Novo status", exact: true }).click();
  await manager(page).getByLabel("Nome do status").fill("Status mobile");
  await manager(page).getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(manager(page).getByLabel("Editar Status mobile", { exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/status-manager-mobile.png" });
  await page.keyboard.press("Escape"); await expect(manager(page)).toHaveCount(0);
  await expect(taskForm(page).getByPlaceholder("Titulo da tarefa...")).toHaveValue("Rascunho mobile");
  expect(mock.tables.tasks).toHaveLength(3);
});

test("ordinary users see selectable statuses and no management controls", async ({ page }) => {
  await mockSupabase(page, "tecnico"); await login(page);
  await page.getByRole("button", { name: "Nova tarefa em Em Andamento", exact: true }).click();
  await expect(taskForm(page).getByRole("button", { name: "Gerenciar status", exact: true })).toHaveCount(0);
  await expect(taskForm(page).getByRole("button", { name: "Novo status", exact: true })).toHaveCount(0);
  await expect(taskForm(page).getByRole("button", { name: "Concluído", exact: true })).toBeEnabled();
});

test("deleting a status and its tasks keeps the draft visible and prevents saving a deleted task", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page);
  await page.getByText("Tarefa antiga Principal", { exact: true }).click(); await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByPlaceholder("Titulo da tarefa...").fill("Rascunho da tarefa excluída");
  await page.getByRole("button", { name: "Gerenciar status", exact: true }).click();
  await manager(page).getByLabel("Excluir Novo", { exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "Excluir coluna", exact: true });
  await deletion.getByLabel(/Excluir permanentemente as 1 tarefas/).check();
  await deletion.getByRole("button", { name: "Excluir coluna e tarefas" }).click();
  await expect(deletion).toHaveCount(0); await manager(page).getByRole("button", { name: "Fechar gerenciamento" }).click();
  await expect(page.getByPlaceholder("Titulo da tarefa...")).toHaveValue("Rascunho da tarefa excluída");
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Esta tarefa foi excluída junto com o status");
  expect(mock.tables.tasks).toHaveLength(2); expect(mock.tables.tasks.some((task) => task.id_task === 1)).toBe(false);
});

test("warn about functional changes to completed tasks and update reports through kind while preserving task fields", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page); await page.goto("/tarefas/desenvolvimento");
  const before = structuredClone(mock.tables.tasks.find((task) => task.id_task === 3)!);
  await page.getByText("Entrega finalizada", { exact: true }).click();
  await page.getByRole("button", { name: "Gerenciar status", exact: true }).click();
  await manager(page).getByLabel("Editar Finalizado", { exact: true }).click();
  await manager(page).getByLabel("Tipo funcional").selectOption("normal");
  await expect(manager(page)).toContainText("1 tarefa(s) deste status passarão a seguir as regras da função Normal");
  await manager(page).getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(manager(page).getByLabel("Editar Finalizado", { exact: true })).toBeEnabled();
  await manager(page).getByRole("button", { name: "Fechar gerenciamento" }).click();
  expect(mock.tables.tasks.find((task) => task.id_task === 3)).toEqual(before);
  await expect(page.getByRole("button", { name: "Arquivar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Fechar tarefa", exact: true }).click(); await page.goto("/relatorios/desenvolvimento");
  await expect(page.getByText("Concluidas", { exact: true }).locator("..").locator("div").first()).toHaveText("0");
});

test("Realtime updates names, colors, order and deletions without losing a draft or crossing Kanbans", async ({ page }) => {
  const mock = await mockSupabase(page, "supervisor_geral", true); await login(page); await openNewTask(page);
  await taskForm(page).getByPlaceholder("Titulo da tarefa...").fill("Rascunho durante Realtime");
  const work = mock.tables.kanban_columns.find((column) => column.id === mock.work.id)!;
  Object.assign(work, { name: "Alterado em outra sessão", color: "#778899" });
  await expect.poll(() => mock.emitColumnChange(work)).toBeGreaterThan(0);
  await expect(taskForm(page).getByRole("button", { name: "Alterado em outra sessão", exact: true })).toBeVisible();
  await taskForm(page).getByRole("button", { name: "Alterado em outra sessão", exact: true }).click();
  await expect(taskForm(page).getByRole("button", { name: "Alterado em outra sessão", exact: true })).toHaveCSS("color", "rgb(119, 136, 153)");
  Object.assign(work, { position: 0 }); Object.assign(mock.tables.kanban_columns.find((column) => column.id === mock.initial.id)!, { position: 1 });
  mock.emitColumnChange(work);
  await expect(taskForm(page).getByRole("button", { pressed: true })).toHaveText("Alterado em outra sessão");
  await expect.poll(async () => taskForm(page).locator('button[aria-pressed]').allTextContents()).toEqual(["Alterado em outra sessão", "Novo", "Concluído"]);
  const foreign = mock.tables.kanban_columns.find((column) => column.id === mock.final.id)!;
  Object.assign(foreign, { name: "Nome fora do Kanban" }); expect(mock.emitColumnChange(foreign)).toBe(0);
  await expect(taskForm(page).getByRole("button", { name: "Nome fora do Kanban", exact: true })).toHaveCount(0);
  mock.tables.kanban_columns = mock.tables.kanban_columns.filter((column) => column.id !== work.id);
  expect(mock.emitColumnChange(work, "DELETE")).toBeGreaterThan(0);
  await expect(taskForm(page).getByRole("button", { name: "Alterado em outra sessão", exact: true })).toHaveCount(0);
  await expect(taskForm(page).getByPlaceholder("Titulo da tarefa...")).toHaveValue("Rascunho durante Realtime");
  await expect(taskForm(page).getByRole("button", { name: "Criar Tarefa →" })).toBeDisabled();
});
