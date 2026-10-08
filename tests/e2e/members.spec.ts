import { test, expect } from "@playwright/test";
import { login, mockSupabase } from "./fixture";

for (const width of [1440, 390]) {
  test(`simplified member form validates, normalizes and creates with immediate-access feedback at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const mock = await mockSupabase(page); await login(page); await page.goto("/equipe/principal");
    await page.getByRole("button", { name: "Criar membro", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Criar membro", exact: true });
    await dialog.getByLabel("Nome completo").fill("Novo membro");
    await dialog.getByLabel("E-mail", { exact: true }).fill("invalid");
    await dialog.getByLabel("Senha inicial", { exact: true }).fill("tiny");
    await dialog.getByRole("button", { name: "Criar membro", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("E-mail em formato inválido.");
    await dialog.getByLabel("E-mail", { exact: true }).fill(" MEMBER@EXAMPLE.TEST ");
    await dialog.getByRole("button", { name: "Criar membro", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Senha mínima de 6 caracteres.");
    expect(mock.adminRequests).toHaveLength(0);
    await dialog.getByLabel("Senha inicial", { exact: true }).fill("valid-test-password");
    await dialog.getByRole("button", { name: "Mostrar senha inicial" }).click();
    await expect(dialog.getByLabel("Senha inicial", { exact: true })).toHaveAttribute("type", "text");
    await dialog.getByLabel("Cargo").selectOption("financeiro");
    await expect(dialog).toContainText("Financeiro");
    if (width === 390) await page.screenshot({ path: "test-results/member-creation-mobile.png" });
    const sent = page.waitForRequest((request) => request.url().endsWith("/functions/v1/create-member"));
    await dialog.getByRole("button", { name: "Criar membro", exact: true }).click();
    expect((await sent).postDataJSON()).toEqual({ name: "Novo membro", email: "member@example.test", password: "valid-test-password", role: "financeiro" });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Novo membro", { exact: true })).toBeVisible();
    await expect(page.getByText("O usuário já pode acessar o sistema com o e-mail e a senha cadastrados.", { exact: true })).toBeVisible();
    expect(mock.tables.users.find((member) => member.name === "Novo membro")?.department).toBe("financeiro");
    await page.getByRole("button", { name: "Criar membro", exact: true }).click();
    await dialog.getByLabel("Nome completo").fill("Duplicado");
    await dialog.getByLabel("E-mail", { exact: true }).fill("MEMBER@example.test");
    await dialog.getByLabel("Senha inicial", { exact: true }).fill("another-test-password");
    await dialog.getByRole("button", { name: "Criar membro", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("E-mail já cadastrado.");
    expect(mock.adminRequests.filter((name) => name === "create-member")).toHaveLength(1);
  });
}

test("member form prevents concurrent requests and closing during submission, and shows safe Auth errors", async ({ page }) => {
  await mockSupabase(page); await login(page); await page.goto("/equipe/principal");
  let finish!: () => void; const gate = new Promise<void>((resolve) => { finish = resolve; });
  let requests = 0;
  await page.route("**/functions/v1/create-member", async (route) => {
    requests++; await gate;
    await route.fulfill({ status: 409, json: { code: "email_exists", error: "E-mail já cadastrado. Se o membro não aparecer na equipe, solicite a revisão do cadastro a um administrador." } });
  });
  await page.getByRole("button", { name: "Criar membro", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Criar membro", exact: true });
  await dialog.getByLabel("Nome completo").fill("Membro");
  await dialog.getByLabel("E-mail", { exact: true }).fill("auth-only@example.test");
  await dialog.getByLabel("Senha inicial", { exact: true }).fill("valid-test-password");
  await dialog.getByRole("button", { name: "Criar membro", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => requests).toBe(1);
  await expect(dialog.getByLabel("Nome completo")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Fechar cadastro" })).toBeDisabled();
  await page.mouse.click(1, 1); await expect(dialog).toBeVisible();
  finish();
  await expect(dialog.getByRole("alert")).toContainText("E-mail já cadastrado");
  await expect(dialog.getByLabel("Nome completo")).toBeEnabled();
  await expect(dialog.getByLabel("E-mail", { exact: true })).toHaveValue("auth-only@example.test");
  await expect(dialog.getByLabel("Senha inicial", { exact: true })).toHaveValue("valid-test-password");
  expect(requests).toBe(1);
});
