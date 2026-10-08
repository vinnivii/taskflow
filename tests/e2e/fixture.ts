import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

type Row = Record<string, unknown>;
const timestamp = () => new Date().toISOString();
export async function mockSupabase(page: Page, role = "supervisor_geral") {
  const actor = { id: "10000000-0000-4000-8000-000000000001", email: "supervisor@example.test", name: "Supervisor Teste", role, department: "suporte", avatar: "", created_at: timestamp() };
  const authUser = { ...actor, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [] };
  const jwt = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: actor.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), "test-signature"].join(".");
  const kanban = (name: string, slug: string, position: number) => ({ id: randomUUID(), name, slug, position, color: "#123456", created_by: actor.id, created_at: timestamp() });
  const principal = kanban("Principal", "principal", 0);
  const development = kanban("Desenvolvimento", "desenvolvimento", 1);
  const makeColumn = (parent: Row, name: string, key: string, kind: string, position: number) => ({ id: randomUUID(), kanban_id: parent.id, name, key, kind, position, color: "#123456", created_at: timestamp() });
  const initial = makeColumn(principal, "Novo", "novo", "normal", 0);
  const work = makeColumn(principal, "Em Andamento", "em_andamento", "normal", 1);
  const done = makeColumn(principal, "Concluído", "concluido", "completed", 2);
  const open = makeColumn(development, "Aberto", "aberto", "normal", 0);
  const final = makeColumn(development, "Finalizado", "finalizado", "completed", 1);
  const blocked = makeColumn(development, "Impedido", "impedido", "blocked", 2);
  const makeTask = (parent: Row, column: Row, title: string, idTask: number) => ({ id: randomUUID(), kanban_id: parent.id, column_id: column.id, status: column.key, title, id_task: idTask, display_id: "", id_rfc: 900 + idTask, priority: "medium", department: "suporte", description: "Descrição preservada", creator_id: actor.id, assignee_id: null, customer_id: null, due_date: "2020-01-01T00:00:00Z", tags: [], attachments_count: 0, archived: false, archived_at: null, created_at: timestamp(), updated_at: timestamp() });
  const tables: Record<string, Row[]> = {
    kanbans: [principal, development], kanban_columns: [initial, work, done, open, final, blocked],
    tasks: [makeTask(principal, initial, "Tarefa antiga Principal", 1), makeTask(development, open, "Tarefa Desenvolvimento", 2), makeTask(development, final, "Entrega finalizada", 3)],
    users: [actor], customers: [], notifications: [], comments: [], activity_logs: [],
  };
  for (const task of tables.tasks) tables.activity_logs.push({ id: randomUUID(), task_id: task.id, user_id: actor.id, action: "created", details: `Atividade ${task.title}`, created_at: timestamp() });
  const taskRequests: (string | null)[] = [];
  await page.route("**/api/uptime-kuma/**", (route) => route.fulfill({ json: { publicGroupList: [], heartbeatList: {} } }));
  await page.route("https://timeapi.io/**", (route) => route.fulfill({ json: { dateTime: timestamp() } }));
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    const parts = url.pathname.split("/"); const method = request.method();
    if (method === "OPTIONS") { await route.fulfill({ status: 200 }); return; }
    if (url.pathname.startsWith("/auth/")) {
      const json = url.pathname.endsWith("/user") ? authUser : { access_token: jwt, refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: authUser };
      await route.fulfill({ json }); return;
    }
    if (parts.includes("rpc")) {
      const name = parts.at(-1); const payload = request.postDataJSON();
      let json: unknown = null;
      if (name === "create_kanban") {
        const created = kanban(payload.p_name, payload.p_slug, tables.kanbans.length);
        tables.kanbans.push(created); tables.kanban_columns.push(makeColumn(created, "Aberto", "aberto", "normal", 0)); json = created;
      } else if (name === "reorder_kanbans" || name === "reorder_kanban_columns") {
        const table = name === "reorder_kanbans" ? "kanbans" : "kanban_columns";
        payload.p_ids.forEach((id: string, position: number) => { const row = tables[table].find((entry) => entry.id === id); if (row) row.position = position; });
      }
      await route.fulfill({ json }); return;
    }
    const table = parts.at(-1)!;
    if (!tables[table]) { await route.fulfill({ json: [] }); return; }
    const matches = (row: Row) => [...url.searchParams].every(([key, value]) => !value.startsWith("eq.") || key.includes(".") || String(row[key]) === value.slice(3));
    if (table === "tasks" && method === "GET") taskRequests.push(url.searchParams.get("kanban_id"));
    let rows: Row[];
    if (method === "POST") {
      const payload = request.postDataJSON();
      rows = (Array.isArray(payload) ? payload : [payload]).map((data) => ({ id: randomUUID(), created_at: timestamp(), updated_at: timestamp(), position: 0, kind: "normal", ...data }));
      if (table === "tasks") rows.forEach((row) => { row.id_task = tables.tasks.length + 1; row.status = tables.kanban_columns.find((column) => column.id === row.column_id)?.key; });
      tables[table].push(...rows);
    } else if (method === "PATCH") {
      rows = tables[table].filter(matches);
      rows.forEach((row) => Object.assign(row, request.postDataJSON()));
    } else if (method === "DELETE") {
      rows = tables[table].filter(matches); tables[table] = tables[table].filter((row) => !matches(row));
      if (table === "kanbans") tables.kanban_columns = tables.kanban_columns.filter((row) => !rows.some((parent) => parent.id === row.kanban_id));
    } else rows = tables[table].filter(matches);
    if (table === "kanbans") rows = rows.map((row) => ({ ...row, tasks: [{ count: tables.tasks.filter((task) => task.kanban_id === row.id).length }] }));
    if (table === "activity_logs" && url.searchParams.has("tasks.kanban_id")) {
      rows = rows.filter((row) => tables.tasks.some((task) => task.id === row.task_id && `eq.${task.kanban_id}` === url.searchParams.get("tasks.kanban_id"))).map((row) => ({ ...row, tasks: { title: tables.tasks.find((task) => task.id === row.task_id)?.title } }));
    }
    const order = url.searchParams.get("order");
    if (order?.startsWith("position")) rows = [...rows].sort((a, b) => Number(a.position) - Number(b.position));
    const offset = Number(url.searchParams.get("offset") ?? 0); const limit = Number(url.searchParams.get("limit") ?? rows.length);
    rows = rows.slice(offset, offset + limit);
    const single = request.headers().accept?.includes("application/vnd.pgrst.object");
    await route.fulfill({ status: 200, json: single ? rows[0] ?? null : rows });
  });
  return { tables, taskRequests, principal, development, initial, work, final, blocked };
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("supervisor@example.test");
  await page.locator('input[type="password"]').fill("test-password-only");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/quadro/principal");
  await page.getByText("Tarefa antiga Principal", { exact: true }).waitFor();
}
