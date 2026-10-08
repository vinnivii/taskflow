import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminHandler } from "../../supabase/functions/_shared/admin.ts";

const settings = JSON.parse(readFileSync(process.env.SUPABASE_LOCAL_STATUS_FILE!, "utf8"));
const url = settings.API_URL ?? settings.api?.url;
assert.ok(url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname), "Integration tests require an isolated local Supabase");
const serviceKey = settings.SERVICE_ROLE_KEY ?? settings.auth?.service_role_key;
const anonKey = settings.ANON_KEY ?? settings.auth?.anon_key;
assert.ok(serviceKey && anonKey, "Local Supabase keys required");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);
const ids: string[] = [];
const initialPassword = "TaskFlow-Test8!initial";
const suffix = randomUUID();
const emailFor = (name: string) => `${name}-${suffix}@example.test`;
async function login(email: string, password = initialPassword) {
  return createClient(url, anonKey, options).auth.signInWithPassword({ email, password });
}
async function fixture(name: string, role: string) {
  const email = emailFor(name);
  const { data, error } = await admin.auth.admin.createUser({ email, password: initialPassword, email_confirm: true });
  assert.equal(error, null); ids.push(data.user!.id);
  const profile = { id: data.user!.id, email, name, role, department: "suporte" };
  assert.equal((await admin.from("users").insert(profile)).error, null);
  const signedIn = await login(email); assert.equal(signedIn.error, null);
  return { ...profile, token: signedIn.data.session!.access_token };
}
const handler = createAdminHandler("create-member", { client: admin, secret: () => undefined });
const request = (token: string, body: object) => new Request(`${url}/functions/v1/create-member`, {
  method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
});
let checks = 0;
try {
  const supervisor = await fixture("existing-supervisor", "supervisor_geral");
  const oldMember = await fixture("existing-member", "tecnico");
  checks += 2;
  const members: { id: string; email: string }[] = [];
  for (const role of ["supervisor_geral", "supervisor_adjunto", "tecnico", "estagiario", "comercial", "financeiro"]) {
    const email = emailFor(role);
    const response = await handler(request(supervisor.token, { name: role, email: ` ${email.toUpperCase()} `, password: initialPassword, role }));
    assert.equal(response.status, 200, await response.clone().text());
    const { memberId, member } = await response.json(); ids.push(memberId); members.push({ id: memberId, email });
    assert.equal(member.id, memberId); assert.equal(member.email, email);
    assert.equal(member.role, role); assert.equal(member.department, ["comercial", "financeiro"].includes(role) ? role : "suporte");
    assert.ok(member.created_at); assert.equal(member.avatar, ""); assert.equal("password" in member, false);
    const auth = await admin.auth.admin.getUserById(memberId);
    assert.equal(auth.error, null); assert.ok(auth.data.user!.email_confirmed_at);
    const profile = await admin.from("users").select("id,role,department").eq("id", memberId).single();
    assert.equal(profile.error, null); assert.equal(profile.data!.id, auth.data.user!.id);
    const memberClient = createClient(url, anonKey, options);
    const signedIn = await memberClient.auth.signInWithPassword({ email, password: initialPassword });
    assert.equal(signedIn.error, null); assert.equal(signedIn.data.user!.id, memberId);
    const accessibleProfile = await memberClient.from("users").select("id").eq("id", memberId).single();
    assert.equal(accessibleProfile.error, null); assert.equal(accessibleProfile.data!.id, memberId);
    const audit = await admin.from("admin_audit").select("id").eq("action", "create_member").contains("details", { member_id: memberId });
    assert.equal(audit.error, null); assert.equal(audit.data!.length, 1);
    checks += 6;
  }
  const duplicate = { name: "Duplicate", email: members[0].email, password: initialPassword, role: "tecnico" };
  assert.equal((await handler(request(supervisor.token, duplicate))).status, 409);
  assert.equal((await admin.auth.admin.getUserById(members[0].id)).error, null); checks += 2;
  const orphanEmail = emailFor("auth-only");
  const authOnly = await admin.auth.admin.createUser({ email: orphanEmail, password: initialPassword, email_confirm: true });
  assert.equal(authOnly.error, null); ids.push(authOnly.data.user!.id);
  assert.equal((await handler(request(supervisor.token, { ...duplicate, email: orphanEmail }))).status, 409);
  assert.equal((await admin.auth.admin.getUserById(authOnly.data.user!.id)).error, null); checks += 2;
  assert.equal((await handler(request(supervisor.token, { ...duplicate, email: emailFor("weak"), password: "tiny" }))).status, 400);
  assert.equal((await handler(request(supervisor.token, { ...duplicate, email: "invalid" }))).status, 400); checks += 2;
  for (const role of ["supervisor_adjunto", "tecnico", "estagiario", "comercial", "financeiro"]) {
    const member = members.find((entry) => entry.email === emailFor(role))!;
    const signedIn = await login(member.email);
    assert.equal((await handler(request(signedIn.data.session!.access_token, { ...duplicate, email: emailFor("denied") }))).status, 403);
    checks++;
  }
  assert.equal((await handler(request("forged-token", duplicate))).status, 401); checks++;
  const reset = createAdminHandler("reset-member-password", { client: admin, secret: () => undefined });
  const newPassword = "TaskFlow-Test9!changed";
  const resetResponse = await reset(request(supervisor.token, { memberId: members[5].id, password: newPassword }));
  assert.equal(resetResponse.status, 200);
  assert.equal((await login(members[5].email, newPassword)).error, null);
  assert.ok((await login(members[5].email)).error); checks += 3;
  assert.equal((await login(supervisor.email)).data.user!.id, supervisor.id);
  assert.equal((await login(oldMember.email)).data.user!.id, oldMember.id); checks += 2;
  const accountsBefore = (await admin.auth.admin.listUsers()).data.users.length;
  const failingClient = createClient(url, serviceKey, { ...options, global: { fetch: async (input, init) => {
    if (String(input).includes("/rest/v1/users") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      return fetch(input, { ...init, body: JSON.stringify({ ...body, role: "invalid-role-for-compensation-test" }) });
    }
    return fetch(input, init);
  } } });
  const failing = createAdminHandler("create-member", { client: failingClient, secret: () => undefined });
  const failure = await failing(request(supervisor.token, { ...duplicate, email: emailFor("rollback") }));
  assert.equal(failure.status, 500); assert.equal((await failure.json()).code, "profile_failed");
  assert.equal((await admin.auth.admin.listUsers()).data.users.length, accountsBefore);
  assert.equal((await login(oldMember.email)).data.user!.id, oldMember.id); checks += 3;
  console.log(`${checks} real Supabase Auth/Postgres checks passed; no production access or email delivery.`);
} finally {
  for (const id of ids.reverse()) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
}
