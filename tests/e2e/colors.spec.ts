import { test, expect, type Locator } from "@playwright/test";
import { login, mockSupabase } from "./fixture";

async function selectVisualColor(scope: Locator, color: string) {
  // Exercise the native control's events without opening the operating system's color dialog.
  await scope.getByLabel("Selecionar cor RGB").evaluate((element, selected) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, selected);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, color);
}

async function setRgb(scope: Locator, red: number, green: number, blue: number) {
  await scope.getByLabel("Vermelho (R)").fill(String(red));
  await scope.getByLabel("Verde (G)").fill(String(green));
  await scope.getByLabel("Azul (B)").fill(String(blue));
}

test("create and edit Kanbans with synchronized RGB, visual, palette and hexadecimal controls", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page); await page.goto("/configuracoes/principal");
  await page.getByRole("button", { name: "Novo Kanban", exact: true }).click();
  await page.getByLabel("Nome do Kanban", { exact: true }).fill("Cores RGB");
  const form = page.locator("form");
  await form.getByLabel("Cor personalizada").fill("#a1b2c3");
  await expect(form.getByLabel("Vermelho (R)")).toHaveValue("161");
  await expect(form.getByLabel("Verde (G)")).toHaveValue("178");
  await expect(form.getByLabel("Azul (B)")).toHaveValue("195");
  await expect(form.getByLabel("Selecionar cor RGB")).toHaveValue("#a1b2c3");
  await form.getByRole("button", { name: "Cor #EF4444", exact: true }).click();
  await expect(form.getByLabel("Vermelho (R)")).toHaveValue("239");
  await expect(form.getByLabel("Verde (G)")).toHaveValue("68");
  await expect(form.getByLabel("Azul (B)")).toHaveValue("68");
  await setRgb(form, 1, 128, 255);
  await expect(form.getByLabel("Cor personalizada")).toHaveValue("#0180FF");
  await expect(form.getByLabel("Selecionar cor RGB")).toHaveValue("#0180ff");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/configuracoes\/cores-rgb$/);
  const created = mock.tables.kanbans.find((row) => row.slug === "cores-rgb")!;
  expect(created.color).toBe("#0180FF");
  await page.getByLabel("Editar Cores RGB", { exact: true }).click();
  await expect(form.getByLabel("Verde (G)")).toHaveValue("128");
  await form.getByLabel("Cor personalizada").fill("#XYZXYZ");
  await expect(form.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
  await expect(form.getByLabel("Vermelho (R)")).toBeDisabled();
  await selectVisualColor(form, "#12ab34");
  await expect(form.getByLabel("Cor personalizada")).toHaveValue("#12AB34");
  await expect(form.getByLabel("Verde (G)")).toHaveValue("171");
  await setRgb(form, 256, -1, 4.5);
  await expect(form.getByLabel("Vermelho (R)")).toHaveValue("255");
  await expect(form.getByLabel("Verde (G)")).toHaveValue("0");
  await expect(form.getByLabel("Azul (B)")).toHaveValue("5");
  await form.getByLabel("Vermelho (R)").fill("");
  await expect(form.getByLabel("Vermelho (R)")).toHaveValue("");
  await form.getByLabel("Vermelho (R)").blur();
  await expect(form.getByLabel("Vermelho (R)")).toHaveValue("255");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByLabel("Editar Cores RGB", { exact: true })).toBeEnabled();
  expect(mock.tables.kanbans.find((row) => row.id === created.id)?.color).toBe("#FF0005");
});

test("create and edit column colors without changing task assignments or column identity", async ({ page }) => {
  const mock = await mockSupabase(page); await login(page); await page.goto("/configuracoes/principal");
  const originalTasks = structuredClone(mock.tables.tasks);
  await page.getByRole("button", { name: "Nova coluna", exact: true }).click();
  const form = page.locator("form");
  await form.getByLabel("Nome da coluna", { exact: true }).fill("Coluna RGB");
  await setRgb(form, 17, 34, 51);
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByLabel("Editar Coluna RGB", { exact: true })).toBeEnabled();
  const created = { ...mock.tables.kanban_columns.find((row) => row.name === "Coluna RGB")! };
  expect(created.color).toBe("#112233");
  await page.getByLabel("Editar Coluna RGB", { exact: true }).click();
  await expect(form.getByLabel("Vermelho (R)")).toHaveValue("17");
  await selectVisualColor(form, "#abcdef");
  await expect(form.getByLabel("Azul (B)")).toHaveValue("239");
  await form.getByLabel("Azul (B)").fill("0");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByLabel("Editar Coluna RGB", { exact: true })).toBeEnabled();
  expect(mock.tables.kanban_columns.find((row) => row.id === created.id)).toEqual({ ...created, color: "#ABCD00" });
  expect(mock.tables.tasks).toEqual(originalTasks);
  await page.goto("/quadro/principal");
  await expect(page.getByRole("button", { name: "Nova tarefa em Coluna RGB", exact: true })).toBeVisible();
});

test("use RGB on mobile in status creation and editing while preserving the task draft", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await mockSupabase(page); await login(page);
  const originalTasks = structuredClone(mock.tables.tasks);
  await page.getByRole("button", { name: "Nova tarefa em Novo", exact: true }).click();
  const task = page.getByRole("dialog", { name: "Nova tarefa", exact: true });
  await task.getByPlaceholder("Titulo da tarefa...").fill("Rascunho com cores");
  await task.getByRole("button", { name: "Novo status", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Gerenciar status", exact: true });
  await dialog.getByLabel("Nome do status").fill("Status RGB");
  await setRgb(dialog, 0, 255, 128);
  for (const name of ["Selecionar cor RGB", "Vermelho (R)", "Verde (G)", "Azul (B)"]) {
    const control = dialog.getByLabel(name);
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: "test-results/rgb-status-mobile.png" });
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByLabel("Editar Status RGB", { exact: true })).toBeEnabled();
  const created = mock.tables.kanban_columns.find((row) => row.name === "Status RGB")!;
  expect(created.color).toBe("#00FF80");
  await dialog.getByLabel("Editar Status RGB", { exact: true }).click();
  await expect(dialog.getByLabel("Verde (G)")).toHaveValue("255");
  await selectVisualColor(dialog, "#123456");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByLabel("Editar Status RGB", { exact: true })).toBeEnabled();
  expect(mock.tables.kanban_columns.find((row) => row.id === created.id)?.color).toBe("#123456");
  await dialog.getByRole("button", { name: "Fechar gerenciamento" }).click();
  await expect(task.getByPlaceholder("Titulo da tarefa...")).toHaveValue("Rascunho com cores");
  expect(mock.tables.tasks).toEqual(originalTasks);
});
