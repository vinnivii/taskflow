import { test, expect } from "@playwright/test";
import { login, mockSupabase } from "./fixture";

test("login, route refresh, safe fallback and strict page/report isolation", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page);
  await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toHaveCount(0);
  await page.getByLabel("Kanban atual").first().selectOption("desenvolvimento");
  await expect(page).toHaveURL(/quadro\/desenvolvimento$/);
  await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toBeVisible();
  await expect(page.getByText("Tarefa antiga Principal", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Filtrar coluna").locator("option")).toHaveText(["Status", "Aberto", "Finalizado", "Impedido"]);
  await page.reload(); await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toBeVisible();
  await page.goto("/tarefas/desenvolvimento");
  await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toBeVisible();
  await expect(page.getByText("Tarefa antiga Principal", { exact: true })).toHaveCount(0);
  await page.goto("/relatorios/desenvolvimento");
  await expect(page.getByText("Atividade Tarefa antiga Principal")).toHaveCount(0);
  await expect(page.getByText("Atividade Tarefa Desenvolvimento")).toBeVisible();
  await expect(page.getByText("Total de tarefas", { exact: true }).locator("..").locator("div").first()).toHaveText("2");
  await expect(page.getByText("Concluidas", { exact: true }).locator("..").locator("div").first()).toHaveText("1");
  await expect(page.getByText("Pendentes", { exact: true }).locator("..")).toContainText("1 atrasadas");
  await expect(page.getByText("Finalizado", { exact: true }).first()).toBeVisible();
  await page.goto("/quadro/inexistente"); await expect(page).toHaveURL(/quadro\/desenvolvimento$/);
  await expect(page.getByText("Entrega finalizada", { exact: true })).toBeVisible();
  expect(mock.taskRequests.every((filter) => filter === `eq.${mock.principal.id}` || filter === `eq.${mock.development.id}`)).toBe(true);
});

test("create Kanban, custom columns, task from plus button, slug rename and deletion counts", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page); await page.goto("/configuracoes/principal");
  await expect(page.getByLabel("Excluir Principal", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Novo Kanban", exact: true }).click();
  await page.getByLabel("Nome do Kanban", { exact: true }).fill("Operação Interna");
  await expect(page.getByLabel("Slug do Kanban")).toHaveValue("operacao-interna");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/configuracoes\/operacao-interna$/);
  for (const [name, kind] of [["Homologação", "normal"], ["Finalizado", "completed"], ["Impedido", "blocked"]]) {
    await page.getByRole("button", { name: "Nova coluna", exact: true }).click();
    await page.getByLabel("Nome da coluna", { exact: true }).fill(name);
    await page.getByLabel("Função da coluna").selectOption(kind);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByLabel(`Editar ${name}`, { exact: true })).toBeVisible();
  }
  await page.getByLabel("Editar Operação Interna", { exact: true }).click();
  await page.getByLabel("Slug do Kanban").fill("operacao-v2");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/configuracoes\/operacao-v2$/);
  await page.goto("/quadro/operacao-v2");
  await page.getByLabel("Nova tarefa em Homologação").click();
  await page.getByPlaceholder("Titulo da tarefa...").fill("Tarefa nova isolada");
  await page.getByRole("dialog").getByRole("button", { name: "Criar Tarefa →", exact: true }).click();
  await expect(page.getByText("Tarefa nova isolada", { exact: true })).toBeVisible();
  const task = mock.tables.tasks.find((entry) => entry.title === "Tarefa nova isolada")!;
  const parent = mock.tables.kanbans.find((entry) => entry.slug === "operacao-v2")!;
  const column = mock.tables.kanban_columns.find((entry) => entry.kanban_id === parent.id && entry.name === "Homologação")!;
  expect(task.kanban_id).toBe(parent.id); expect(task.column_id).toBe(column.id);
  await page.goto("/configuracoes/operacao-v2");
  await expect(page.getByLabel("Excluir Operação Interna", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Excluir Homologação", { exact: true })).toBeDisabled();
  await page.goto("/quadro/principal"); await expect(page.getByText("Tarefa nova isolada", { exact: true })).toHaveCount(0);
});

test("desktop drag, actual column activity and completed-kind archiving", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page);
  const card = page.getByText("Tarefa antiga Principal", { exact: true }).locator("..");
  const source = await card.boundingBox();
  const destination = await page.getByRole("heading", { name: "Em Andamento", exact: true }).boundingBox();
  if (!source || !destination) throw new Error("Missing drag target");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down(); await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 3 });
  await page.mouse.move(destination.x + 100, destination.y + 150, { steps: 15 }); await page.mouse.up();
  await expect.poll(() => mock.tables.tasks[0].column_id).toBe(mock.work.id);
  await expect.poll(() => mock.tables.activity_logs.some((entry) => String(entry.details).includes("Em Andamento"))).toBe(true);
  await page.getByLabel("Kanban atual").first().selectOption("desenvolvimento");
  const finished = page.getByText("Entrega finalizada", { exact: true });
  await finished.click();
  await page.getByRole("dialog").getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(finished).toHaveCount(0);
  const archived = mock.tables.tasks.find((entry) => entry.title === "Entrega finalizada")!;
  expect(archived.archived).toBe(true); expect(archived.column_id).toBe(mock.final.id); expect(archived.kanban_id).toBe(mock.development.id);
  await page.goto("/tarefas/desenvolvimento");
  await expect(page.getByText("Entrega finalizada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Arquivada", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desarquivar", exact: true }).click();
  await expect.poll(() => archived.archived).toBe(false);
  expect(archived.column_id).toBe(mock.final.id);
});

test("mobile switching, status filter, modal, refresh and ordinary-user administration guard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSupabase(page, "tecnico"); await login(page);
  await expect(page.getByLabel("Kanban atual").first()).toBeVisible();
  await page.getByLabel("Kanban atual").first().selectOption("desenvolvimento");
  await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finalizado (1)", exact: true }).click();
  await expect(page.getByText("Entrega finalizada", { exact: true })).toBeVisible();
  await page.getByText("Entrega finalizada", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Arquivar", exact: true })).toHaveCount(0);
  await page.goto("/configuracoes/desenvolvimento");
  await expect(page).toHaveURL(/quadro\/(principal|desenvolvimento)$/);
  await page.getByLabel("Kanban atual").first().selectOption("desenvolvimento");
  await page.reload(); await expect(page).toHaveURL(/quadro\/desenvolvimento$/);
  await page.screenshot({ path: "test-results/mobile-multi-kanban.png", fullPage: true });
});

test("mobile drag with touch input, search by ID/RFC and pagination resets on switching", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await mockSupabase(page);
  for (let index = 0; index < 25; index++) mock.tables.tasks.push({ ...mock.tables.tasks[0], id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`, title: `Tarefa extra ${index}`, id_task: index + 10 });
  await login(page); await page.goto("/tarefas/principal");
  await page.getByRole("button", { name: "Próximo", exact: true }).click();
  await page.getByLabel("Kanban atual").first().selectOption("desenvolvimento");
  await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toBeVisible();
  await expect(page.getByText("Entrega finalizada", { exact: true })).toBeVisible();
  await page.goto("/quadro/desenvolvimento");
  const handle = page.getByText("Tarefa Desenvolvimento", { exact: true }).locator("..").getByRole("button");
  const source = await handle.boundingBox(); const destination = await page.getByRole("button", { name: "Finalizado (1)", exact: true }).boundingBox();
  if (!source || !destination) throw new Error("Missing mobile drag handle");
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: source.x + source.width / 2, y: source.y + source.height / 2, id: 1 }] });
  // Support both the touch delay and pointer-distance activation on mobile.
  await page.waitForTimeout(200);
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: source.x + source.width / 2 - 12, y: source.y + source.height / 2, id: 1 }] });
  await expect(page.getByRole("status")).toContainText(/picked up/i);
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: destination.x + destination.width / 2, y: destination.y + destination.height / 2, id: 1 }] });
  await expect(page.getByRole("button", { name: "Finalizado (1)", exact: true })).toHaveCSS("transform", "matrix(1.06, 0, 0, 1.06, 0, 0)");
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => mock.tables.tasks.find((entry) => entry.title === "Tarefa Desenvolvimento")?.column_id).toBe(mock.final.id);
  await touch.detach();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tarefas/desenvolvimento");
  const search = page.getByPlaceholder("Buscar tarefas, IDs ou responsaveis...");
  await search.fill("#2"); await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toBeVisible();
  await expect(page.getByText("Entrega finalizada", { exact: true })).toHaveCount(0);
  await search.fill("RFC-903"); await expect(page.getByText("Entrega finalizada", { exact: true })).toBeVisible();
  await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Modo claro", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
});

test("selection with expanded/collapsed sidebar and recovery after deleting the last empty Kanban", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByLabel("Expandir menu", { exact: true }).click();
  await expect(page.getByLabel("Kanban atual").first()).toBeVisible();
  const selectBox = await page.getByLabel("Kanban atual").first().boundingBox();
  expect(selectBox && selectBox.x + selectBox.width).toBeLessThanOrEqual(1024);
  await page.getByLabel("Kanban atual").first().selectOption("desenvolvimento");
  await expect(page.getByText("Tarefa Desenvolvimento", { exact: true })).toBeVisible();
  await page.getByLabel("Recolher menu", { exact: true }).click();
  await expect(page.getByLabel("Kanban atual").first()).toHaveValue("desenvolvimento");
  mock.tables.tasks = []; mock.tables.activity_logs = [];
  await page.goto("/configuracoes/principal");
  for (const name of ["Desenvolvimento", "Principal"]) {
    await page.getByLabel(`Excluir ${name}`, { exact: true }).click();
    await page.getByRole("button", { name: "Confirmar exclusão", exact: true }).click();
    await expect(page.getByLabel(`Editar ${name}`, { exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Novo Kanban", exact: true }).click();
  await page.getByLabel("Nome do Kanban", { exact: true }).fill("Recomeço");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/configuracoes\/recomeco$/);
  await expect(page.getByLabel("Editar Aberto", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/kanban-configuration.png", fullPage: true });
});
