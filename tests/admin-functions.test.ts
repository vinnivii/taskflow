import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupStorage, createAdminHandler, type AdminEndpoint } from "../supabase/functions/_shared/admin";

function fixture(role = "supervisor_geral") {
  const actorId = randomUUID();
  const memberId = randomUUID();
  const secret = randomUUID();
  const profiles = new Map([[actorId, { id: actorId, role }], [memberId, { id: memberId, role: "tecnico" }]]);
  const credentials = new Map([[memberId, { email: "member@example.test", password: "old-test-password" }]]);
  let allowed = true;
  let profileFailure = false;
  let authError: { code: string; msg: string; status: number } | null = null;
  let auditFailure = false;
  let cleanupFailure = false;
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input)); const path = url.pathname; const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    const headers = new Headers(init?.headers);
    calls.push({ path, method, body });
    const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" } });
    if (path === "/auth/v1/user") return headers.get("Authorization") === "Bearer verified-admin-session" ? response({ id: actorId, email: "admin@example.test" }) : response({ msg: "Invalid JWT" }, 401);
    if (path === "/auth/v1/admin/users" && method === "POST") {
      if (authError) return response({ code: authError.code, msg: authError.msg }, authError.status);
      if ([...credentials.values()].some((value) => value.email === body.email)) return response({ code: "email_exists", msg: "A user with this email address has already been registered" }, 422);
      const id = randomUUID(); credentials.set(id, { email: body.email, password: body.password }); return response({ id, email: body.email, email_confirmed_at: body.email_confirm ? new Date().toISOString() : null });
    }
    if (path.startsWith("/auth/v1/admin/users/") && method === "PUT") {
      const id = path.split("/").at(-1)!;
      Object.assign(credentials.get(id)!, { password: body.password }); return response({ id, email: credentials.get(id)!.email });
    }
    if (path.startsWith("/auth/v1/admin/users/") && method === "DELETE") {
      if (cleanupFailure) return response({ code: "unexpected_failure", msg: "simulated failure" }, 500);
      const id = path.split("/").at(-1)!; credentials.delete(id); profiles.delete(id); return response({});
    }
    if (path === "/auth/v1/token") {
      const member = [...credentials.entries()].find(([, value]) => value.email === body.email && value.password === body.password);
      return member ? response({ access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user: { id: member[0], email: body.email } }) : response({ msg: "Invalid login credentials", error_code: "invalid_credentials" }, 400);
    }
    if (path === "/rest/v1/users") {
      if (method === "POST") {
        if (profileFailure) return response({ message: "simulated database failure" }, 500);
        const profile = { ...body, created_at: new Date().toISOString() }; profiles.set(body.id, profile); return response(profile, 201);
      }
      const id = url.searchParams.get("id")?.slice(3); return response(profiles.get(id ?? "") ?? null);
    }
    if (path.endsWith("reserve_kanban_delete_attempt")) return response(allowed);
    if (path.endsWith("transfer_delete_kanban")) return response({ transferred: 3 });
    if (path === "/rest/v1/admin_audit") return auditFailure ? response({ code: "42501", message: "private internal detail" }, 403) : response(null, 201);
    return response([]);
  });
  const client = createClient("https://supabase.example.test", "server-key-test-only", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  const handler = (endpoint: AdminEndpoint) => createAdminHandler(endpoint, { client, secret: (name) => name === "KANBAN_DELETE_PASSWORD" ? secret : undefined });
  const request = (body: object, token = "verified-admin-session") => new Request("https://functions.example.test/admin", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { actorId, memberId, secret, profiles, credentials, calls, client, handler, request, setAllowed: (value: boolean) => { allowed = value; }, failProfile: () => { profileFailure = true; }, failAuth: (error: typeof authError) => { authError = error; }, failAudit: () => { auditFailure = true; }, failCleanup: () => { cleanupFailure = true; } };
}
afterEach(() => vi.restoreAllMocks());

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
  it.each(["supervisor_geral", "supervisor_adjunto", "tecnico", "estagiario", "comercial", "financeiro"])("creates %s with an automatically assigned department, confirmed email and immediate login", async (role) => {
    const f = fixture(); const email = `${role}@example.test`; const password = "initial-test-password";
    const response = await f.handler("create-member")(f.request({ name: "  New Member  ", email: ` ${email.toUpperCase()} `, password, role }));
    expect(response.status).toBe(200);
    const { memberId, member } = await response.json();
    expect(member).toMatchObject({ id: memberId, name: "New Member", email, role, department: ["financeiro", "comercial"].includes(role) ? role : "suporte", avatar: "" });
    expect(member.created_at).toBeTruthy(); expect(member).not.toHaveProperty("password");
    expect(f.calls.find((call) => call.path === "/auth/v1/admin/users")?.body).toMatchObject({ email_confirm: true, email, user_metadata: { name: "New Member" } });
    expect((await f.client.auth.signInWithPassword({ email, password })).data.user?.id).toBe(memberId);
    expect((await f.client.auth.signInWithPassword({ email: "member@example.test", password: "old-test-password" })).data.user?.id).toBe(f.memberId);
  });
  it("rejects repeated and simultaneous submissions without changing or deleting existing accounts", async () => {
    const f = fixture(); const body = { name: "Member", email: "NEW@example.test", password: "test-password", role: "tecnico" };
    const results = await Promise.all([f.handler("create-member")(f.request(body)), f.handler("create-member")(f.request(body))]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const repeated = await f.handler("create-member")(f.request(body));
    expect((await repeated.json()).error).toContain("E-mail já cadastrado");
    expect(f.credentials.size).toBe(2); expect(f.profiles.size).toBe(3);
    expect(f.calls.some((call) => call.method === "DELETE")).toBe(false);
  });
  it.each([
    ["weak_password", 422, 400, "Senha não atende"],
    ["email_address_invalid", 422, 400, "E-mail em formato inválido"],
    ["unexpected_failure", 500, 503, "Serviço de autenticação indisponível"],
    ["not_admin", 403, 503, "Serviço de autenticação indisponível"],
    ["over_request_rate_limit", 429, 429, "Muitas solicitações"],
  ] as const)("translates %s without leaking Auth messages or credentials", async (code, status, expectedStatus, expectedMessage) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = fixture(); f.failAuth({ code, status, msg: "internal detail private-email@example.test secret-password private-token" });
    const response = await f.handler("create-member")(f.request({ name: "Member", email: "new@example.test", password: "test-password", role: "tecnico" }));
    expect(response.status).toBe(expectedStatus); expect((await response.json()).error).toContain(expectedMessage);
    const logged = JSON.stringify(log.mock.calls); expect(logged).toContain(code); expect(logged).not.toMatch(/private-email|secret-password|private-token|internal detail/);
    expect(f.credentials.size).toBe(1); expect(f.calls.some((call) => call.method === "DELETE")).toBe(false);
  });
  it("rejects invalid email and password before attempting Auth creation", async () => {
    const f = fixture(); const body = { name: "Member", email: "invalid", password: "test-password", role: "tecnico" };
    const invalid = await f.handler("create-member")(f.request(body)); expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toContain("E-mail em formato inválido");
    expect((await f.handler("create-member")(f.request({ ...body, email: "new@example.test", password: "tiny" }))).status).toBe(400);
    expect(f.calls.some((call) => call.path === "/auth/v1/admin/users")).toBe(false);
  });
  it("compensates a failed audit and leaves old accounts intact", async () => {
    const f = fixture(); f.failAudit();
    const response = await f.handler("create-member")(f.request({ name: "Member", email: "new@example.test", password: "test-password", role: "tecnico" }));
    expect(response.status).toBe(500); expect((await response.json()).code).toBe("audit_failed");
    expect(f.credentials.size).toBe(1); expect(f.profiles.size).toBe(2); expect(f.credentials.has(f.memberId)).toBe(true);
  });
  it("reports incomplete creation when compensation fails, without attempting to delete an old account", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = fixture(); f.failProfile(); f.failCleanup();
    const response = await f.handler("create-member")(f.request({ name: "Member", email: "new@example.test", password: "test-password", role: "tecnico" }));
    expect(response.status).toBe(500); expect((await response.json()).code).toBe("cleanup_failed");
    expect(f.calls.filter((call) => call.method === "DELETE").every((call) => !call.path.endsWith(f.memberId))).toBe(true);
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-password");
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
