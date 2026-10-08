import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

type Row = Record<string, unknown>;
const timestamp = () => new Date().toISOString();
export async function mockSupabase(page: Page, role = "supervisor_geral", realtime = false) {
  type Binding = { id: number; schema: string; table: string; event: string; filter?: string };
  const emitters: ((row: Row, event: string, old: Row) => number)[] = [];
  let bindingId = 0;
  if (realtime) await page.routeWebSocket("ws://127.0.0.1:54321/realtime/v1/**", (socket) => {
    const subscriptions = new Map<string, { joinRef: string; bindings: Binding[] }>();
    socket.onMessage((message) => {
      if (typeof message !== "string") return;
      const [joinRef, ref, topic, event, payload] = JSON.parse(message);
      let response = {};
      if (event === "phx_join") {
        const bindings = (payload.config.postgres_changes ?? []).map((binding: Omit<Binding, "id">) => ({ ...binding, id: ++bindingId }));
        subscriptions.set(topic, { joinRef, bindings }); response = { postgres_changes: bindings };
      }
      if (event === "phx_leave") subscriptions.delete(topic);
      if (["phx_join", "phx_leave", "heartbeat"].includes(event)) socket.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response }]));
    });
    socket.onClose(() => subscriptions.clear());
    emitters.push((row, event, old) => {
      let sent = 0;
      for (const [topic, subscription] of subscriptions) {
        const ids = subscription.bindings.filter((binding) => binding.table === "kanban_columns" && (binding.event === "*" || binding.event === event)
          && (event === "DELETE" ? !binding.filter : !binding.filter || binding.filter === `kanban_id=eq.${row.kanban_id}`)).map((binding) => binding.id);
        if (!ids.length) continue;
        socket.send(JSON.stringify([subscription.joinRef, null, topic, "postgres_changes", { ids, data: { schema: "public", table: "kanban_columns", type: event, commit_timestamp: timestamp(), columns: [], record: event === "DELETE" ? {} : row, old_record: old, errors: null } }]));
        sent++;
      }
      return sent;
    });
  });
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
  const adminRequests: string[] = [];
  const adminPassword = randomUUID();
  const memberPasswords = new Map<string, string>();
  const removeTasks = (ids: unknown[]) => {
    tables.tasks = tables.tasks.filter((row) => !ids.includes(row.id));
    for (const table of ["comments", "activity_logs"]) tables[table] = tables[table].filter((row) => !ids.includes(row.task_id));
    tables.notifications.forEach((row) => { if (ids.includes(row.task_id)) row.task_id = null; });
  };
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
    if (url.pathname.startsWith("/functions/v1/")) {
      const name = parts.at(-1)!; adminRequests.push(name); const payload = request.postDataJSON();
      if (name === "cleanup-task-storage") { await route.fulfill({ json: { completed: 0, pending: 0 } }); return; }
      if (!["supervisor_geral", "supervisor_adjunto"].includes(role) || (name !== "delete-kanban" && role !== "supervisor_geral")) { await route.fulfill({ status: 403, json: { error: "Sem permissão." } }); return; }
      if (name === "create-member") {
        const member = { id: randomUUID(), created_at: timestamp(), avatar: "", name: payload.name, email: payload.email, role: payload.role, department: payload.department };
        tables.users.push(member); memberPasswords.set(member.id, payload.password);
        await route.fulfill({ json: { success: true, memberId: member.id } }); return;
      }
      if (name === "reset-member-password") { memberPasswords.set(payload.memberId, payload.password); await route.fulfill({ json: { success: true } }); return; }
      if (name === "delete-kanban") {
        if (payload.password !== adminPassword) { await route.fulfill({ status: 403, json: { error: "Senha administrativa incorreta." } }); return; }
        const tasks = tables.tasks.filter((task) => task.kanban_id === payload.sourceId);
        tasks.forEach((task) => { task.kanban_id = payload.destinationId; task.column_id = payload.mapping[task.column_id as string]; task.status = tables.kanban_columns.find((column) => column.id === task.column_id)?.key; });
        tables.kanban_columns = tables.kanban_columns.filter((column) => column.kanban_id !== payload.sourceId);
        tables.kanbans = tables.kanbans.filter((kanban) => kanban.id !== payload.sourceId);
        await route.fulfill({ json: { success: true, transferred: tasks.length } }); return;
      }
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
      } else if (name === "kanban_deletion_summary") {
        json = tables.kanban_columns.filter((column) => column.kanban_id === payload.p_kanban_id).map((column) => ({ ...column, task_count: tables.tasks.filter((task) => task.column_id === column.id).length, archived_count: tables.tasks.filter((task) => task.column_id === column.id && task.archived).length }));
      } else if (name === "delete_task_with_cleanup") {
        const task = tables.tasks.find((row) => row.id === payload.p_task_id && row.kanban_id === payload.p_kanban_id);
        if (task) { json = task.id; removeTasks([task.id]); }
      } else if (name === "delete_column_with_tasks") {
        const tasks = tables.tasks.filter((task) => task.column_id === payload.p_column_id);
        if (payload.p_mode === "transfer") tasks.forEach((task) => { task.column_id = payload.p_destination_id; task.status = tables.kanban_columns.find((column) => column.id === payload.p_destination_id)?.key; });
        else removeTasks(tasks.map((task) => task.id));
        tables.kanban_columns = tables.kanban_columns.filter((column) => column.id !== payload.p_column_id); json = { affected: tasks.length };
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
  const emitColumnChange = (row: Row, event = "UPDATE", old: Row = { id: row.id }) => emitters.reduce((count, emit) => count + emit(row, event, old), 0);
  return { tables, taskRequests, adminRequests, adminPassword, memberPasswords, principal, development, initial, work, final, blocked, emitColumnChange };
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("supervisor@example.test");
  await page.locator('input[type="password"]').fill("test-password-only");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/quadro/principal");
  await page.getByText("Tarefa antiga Principal", { exact: true }).waitFor();
}
