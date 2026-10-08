import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { cleanupStorage, createAdminHandler, type AdminEndpoint } from "../supabase/functions/_shared/admin";

function fixture(role = "supervisor_geral") {
  const actorId = randomUUID();
  const memberId = randomUUID();
  const secret = randomUUID();
  const profiles = new Map([[actorId, { id: actorId, role }], [memberId, { id: memberId, role: "tecnico" }]]);
  const credentials = new Map([[memberId, { email: "member@example.test", password: "old-test-password" }]]);
  let allowed = true;
  let profileFailure = false;
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input)); const path = url.pathname; const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    const headers = new Headers(init?.headers);
    calls.push({ path, method, body });
    const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
    if (path === "/auth/v1/user") return headers.get("Authorization") === "Bearer verified-admin-session" ? response({ id: actorId, email: "admin@example.test" }) : response({ msg: "Invalid JWT" }, 401);
    if (path === "/auth/v1/admin/users" && method === "POST") {
      const id = randomUUID(); credentials.set(id, { email: body.email, password: body.password }); return response({ id, email: body.email });
    }
    if (path.startsWith("/auth/v1/admin/users/") && method === "PUT") {
      const id = path.split("/").at(-1)!;
      Object.assign(credentials.get(id)!, { password: body.password }); return response({ id, email: credentials.get(id)!.email });
    }
    if (path.startsWith("/auth/v1/admin/users/") && method === "DELETE") { credentials.delete(path.split("/").at(-1)!); return response({}); }
    if (path === "/auth/v1/token") {
      const member = [...credentials.entries()].find(([, value]) => value.email === body.email && value.password === body.password);
      return member ? response({ access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user: { id: member[0], email: body.email } }) : response({ msg: "Invalid login credentials", error_code: "invalid_credentials" }, 400);
    }
    if (path === "/rest/v1/users") {
      if (method === "POST") {
        if (profileFailure) return response({ message: "simulated database failure" }, 500);
        profiles.set(body.id, body); return response(null, 201);
      }
      const id = url.searchParams.get("id")?.slice(3); return response(profiles.get(id ?? "") ?? null);
    }
    if (path.endsWith("reserve_kanban_delete_attempt")) return response(allowed);
    if (path.endsWith("transfer_delete_kanban")) return response({ transferred: 3 });
    if (path === "/rest/v1/admin_audit") return response(null, 201);
    return response([]);
  });
  const client = createClient("https://supabase.example.test", "server-key-test-only", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  const handler = (endpoint: AdminEndpoint) => createAdminHandler(endpoint, { client, secret: (name) => name === "KANBAN_DELETE_PASSWORD" ? secret : undefined });
  const request = (body: object, token = "verified-admin-session") => new Request("https://functions.example.test/admin", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { actorId, memberId, secret, profiles, credentials, calls, client, handler, request, setAllowed: (value: boolean) => { allowed = value; }, failProfile: () => { profileFailure = true; } };
}

describe("Edge Functions with verified identity and actual Supabase SDK HTTP contracts", () => {
  it("creates Auth user and public profile with department/role, without writing the password to the profile", async () => {
    const f = fixture(); const body = { name: "New Member", email: "new@example.test", password: "test-member-password", role: "financeiro", department: "financeiro" };
    const response = await f.handler("create-member")(f.request(body)); expect(response.status).toBe(200);
    const { memberId } = await response.json(); expect(f.profiles.get(memberId)).toMatchObject({ name: body.name, role: body.role, department: body.department });
    expect(f.profiles.get(memberId)).not.toHaveProperty("password");
    expect(f.credentials.get(memberId)?.password).toBe(body.password);
  });
  it("compensates Auth creation if profile persistence fails", async () => {
    const f = fixture(); f.failProfile();
    const response = await f.handler("create-member")(f.request({ name: "Member", email: "new@example.test", password: "test-password", role: "tecnico", department: "suporte" }));
    expect(response.status).toBe(500); expect(f.credentials.size).toBe(1);
    expect(f.calls.some((call) => call.method === "DELETE" && call.path.includes("/admin/users/"))).toBe(true);
  });
  it("resets through Auth Admin and accepts the new password in the SDK login contract; rejects the previous password", async () => {
    const f = fixture(); const password = "new-test-password";
    const response = await f.handler("reset-member-password")(f.request({ memberId: f.memberId, password })); expect(response.status).toBe(200);
    const login = await f.client.auth.signInWithPassword({ email: "member@example.test", password }); expect(login.error).toBeNull(); expect(login.data.user?.id).toBe(f.memberId);
    const old = await f.client.auth.signInWithPassword({ email: "member@example.test", password: "old-test-password" }); expect(old.error).not.toBeNull();
    expect(JSON.stringify(f.calls.filter((call) => call.path.includes("/rest/")))).not.toContain(password);
    expect(await response.text().catch(() => "")).not.toContain(password);
  });
  it.each(["supervisor_adjunto", "tecnico", "estagiario", "comercial", "financeiro"])("denies member management to %s", async (role) => {
    const f = fixture(role);
    for (const endpoint of ["create-member", "reset-member-password"] as const) expect((await f.handler(endpoint)(f.request({ memberId: f.memberId, password: "test-password" }))).status).toBe(403);
    expect(f.calls.some((call) => call.path.includes("/admin/users"))).toBe(false);
  });
  it("rejects forged sessions, short passwords, malformed IDs, missing members and invalid department", async () => {
    const f = fixture(); const endpoint = f.handler("reset-member-password");
    expect((await endpoint(f.request({ memberId: f.memberId, password: "test-password" }, "forged-session"))).status).toBe(401);
    expect((await endpoint(f.request({ memberId: f.memberId, password: "tiny" }))).status).toBe(400);
    expect((await endpoint(f.request({ memberId: "invalid", password: "test-password" }))).status).toBe(400);
    expect((await endpoint(f.request({ memberId: randomUUID(), password: "test-password" }))).status).toBe(404);
    expect((await f.handler("create-member")(f.request({ name: "Member", email: "m@example.test", password: "test-password", role: "financeiro", department: "suporte" }))).status).toBe(400);
  });
  it("password gates Kanban RPCs; rejects incorrect password, unset secret, invalid mapping and repeated requests", async () => {
    const f = fixture("supervisor_adjunto"); const body = { sourceId: randomUUID(), destinationId: null, mapping: {}, password: f.secret };
    expect((await f.handler("delete-kanban")(f.request({ ...body, password: "wrong-test-password" }))).status).toBe(403);
    expect(f.calls.some((call) => call.path.endsWith("transfer_delete_kanban"))).toBe(false);
    expect((await f.handler("delete-kanban")(f.request(body))).status).toBe(200);
    const mutation = f.calls.find((call) => call.path.endsWith("transfer_delete_kanban"))!;
    expect(mutation.body.p_actor_id).toBe(f.actorId); expect(JSON.stringify(mutation.body)).not.toContain(f.secret);
    expect((await f.handler("delete-kanban")(f.request({ ...body, mapping: { invalid: "invalid" } }))).status).toBe(400);
    f.setAllowed(false); expect((await f.handler("delete-kanban")(f.request(body))).status).toBe(429);
    const unset = createAdminHandler("delete-kanban", { client: f.client, secret: () => undefined }); expect((await unset(f.request(body))).status).toBe(503);
    const forbidden = fixture("tecnico"); expect((await forbidden.handler("delete-kanban")(forbidden.request(body))).status).toBe(403);
  });
  it("keeps failed storage jobs for retry and removes only the deleted task UUID's files", async () => {
    const taskId = randomUUID(); let fail = true; let deletedJob = false; const removed: string[][] = [];
    let listed = false;
    const client = {
      rpc: async () => ({ data: [{ task_id: taskId }], error: null }),
      from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }), delete: () => ({ eq: async () => { if (table === "task_storage_cleanup") deletedJob = true; return { error: null }; } }) }),
      storage: { from: () => ({ list: async (prefix: string) => { expect(prefix).toBe(taskId); return { data: listed ? [] : [{ id: "file", name: "image.png" }], error: null }; }, remove: async (paths: string[]) => { removed.push(paths); if (!fail) listed = true; return { error: fail ? new Error("unavailable") : null }; } }) },
    } as unknown as SupabaseClient;
    expect((await cleanupStorage(client)).pending).toBe(1); expect(deletedJob).toBe(false);
    fail = false; expect((await cleanupStorage(client)).completed).toBe(1); expect(deletedJob).toBe(true);
    expect(removed).toEqual([[`${taskId}/image.png`], [`${taskId}/image.png`]]);
  });
});
