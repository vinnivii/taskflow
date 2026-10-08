import type { SupabaseClient } from "npm:@supabase/supabase-js@2.105.1";

export type AdminEndpoint = "create-member" | "reset-member-password" | "delete-kanban" | "cleanup-task-storage";
export type AdminDependencies = { client: SupabaseClient; secret: (name: string) => string | undefined };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cleanup-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles: Record<string, string> = { supervisor_geral: "suporte", supervisor_adjunto: "suporte", tecnico: "suporte", estagiario: "suporte", comercial: "comercial", financeiro: "financeiro" };
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
function textField(data: Record<string, unknown>, key: string, max = 256) {
  const value = data[key];
  if (typeof value !== "string" || !value.length || value.length > max) throw new HttpError(400, "Dados inválidos.");
  return value;
}
function idField(data: Record<string, unknown>, key: string) {
  const value = textField(data, key, 36);
  if (!uuid.test(value)) throw new HttpError(400, "Identificador inválido.");
  return value;
}
function passwordField(data: Record<string, unknown>) {
  const value = textField(data, "password", 1024);
  if (value.length < 6) throw new HttpError(400, "Senha mínima de 6 caracteres.");
  return value;
}
async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 32768) { await reader.cancel(); throw new HttpError(413, "Solicitação muito grande."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
// Fixed-length digest comparison avoids revealing the secret's length/prefix.
export async function secretsEqual(input: string, expected: string) {
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([hash(input), hash(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export function createAdminHandler(endpoint: AdminEndpoint, dependencies: AdminDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return reply(405, { error: "Método não permitido." });
    const { client, secret } = dependencies;
    try {
      const workerSecret = endpoint === "cleanup-task-storage" ? secret("TASK_STORAGE_CLEANUP_SECRET") : undefined;
      const workerHeader = request.headers.get("x-cleanup-secret");
      const worker = !!workerSecret && !!workerHeader && workerHeader.length <= 1024 && await secretsEqual(workerHeader, workerSecret);
      let actorId: string | undefined;
      if (!worker) {
        const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
        if (!token) throw new HttpError(401, "Sessão inválida. Entre novamente.");
        const { data, error } = await client.auth.getUser(token);
        if (error || !data.user) throw new HttpError(401, "Sessão inválida. Entre novamente.");
        actorId = data.user.id;
        const { data: profile, error: profileError } = await client.from("users").select("role").eq("id", actorId).single();
        const permitted = endpoint === "create-member" || endpoint === "reset-member-password"
          ? profile?.role === "supervisor_geral" : ["supervisor_geral", "supervisor_adjunto"].includes(profile?.role);
        if (profileError || !permitted) throw new HttpError(403, "Sem permissão para esta operação.");
      }
      if (endpoint === "cleanup-task-storage") return reply(200, await cleanupStorage(client));
      // Bound before parsing; passwords never appear in logs or returned errors.
      const raw = await boundedBody(request);
      let data: Record<string, unknown>;
      try { data = JSON.parse(raw); } catch { throw new HttpError(400, "Dados inválidos."); }
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "Dados inválidos.");
      if (endpoint === "create-member") {
        const name = textField(data, "name").trim();
        const email = textField(data, "email").trim();
        const password = passwordField(data);
        const role = textField(data, "role");
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Object.hasOwn(roles, role) || data.department !== roles[role]) throw new HttpError(400, "Nome, e-mail, cargo ou departamento inválido.");
        const { data: created, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
        if (error || !created.user) throw new HttpError(400, "Não foi possível criar o membro. Verifique o e-mail e os requisitos de senha do Auth.");
        const { error: profileError } = await client.from("users").insert({ id: created.user.id, name, email, avatar: "", role, department: roles[role] });
        if (profileError) {
          const { error: cleanupError } = await client.auth.admin.deleteUser(created.user.id);
          if (cleanupError) await client.from("admin_audit").insert({ actor_id: actorId, action: "member_creation_cleanup_failed", details: { member_id: created.user.id } });
          throw new HttpError(500, "Não foi possível concluir o cadastro do membro.");
        }
        await client.from("admin_audit").insert({ actor_id: actorId, action: "create_member", details: { member_id: created.user.id } });
        return reply(200, { success: true, memberId: created.user.id });
      }
      if (endpoint === "reset-member-password") {
        const memberId = idField(data, "memberId");
        const password = passwordField(data);
        const { data: member, error: memberError } = await client.from("users").select("id").eq("id", memberId).single();
        if (memberError || !member) throw new HttpError(404, "Membro não encontrado.");
        const { error } = await client.auth.admin.updateUserById(memberId, { password });
        if (error) throw new HttpError(400, "Não foi possível alterar a senha. Verifique os requisitos de senha do Auth.");
        await client.from("admin_audit").insert({ actor_id: actorId, action: "reset_member_password", details: { member_id: memberId } });
        return reply(200, { success: true });
      }
      const sourceId = idField(data, "sourceId");
      const destinationId = data.destinationId == null ? null : idField(data, "destinationId");
      const password = textField(data, "password", 1024);
      const expected = secret("KANBAN_DELETE_PASSWORD");
      if (!expected) throw new HttpError(503, "Exclusão de Kanban ainda não configurada no servidor.");
      const { data: allowed, error: limitError } = await client.rpc("reserve_kanban_delete_attempt", { p_actor_id: actorId });
      if (limitError) throw new HttpError(503, "Não foi possível validar a operação.");
      if (allowed !== true) throw new HttpError(429, "Limite de tentativas atingido. Tente novamente em 15 minutos.");
      if (!await secretsEqual(password, expected)) throw new HttpError(403, "Senha administrativa incorreta.");
      if (!data.mapping || typeof data.mapping !== "object" || Array.isArray(data.mapping) || Object.entries(data.mapping).some(([key, value]) => !uuid.test(key) || typeof value !== "string" || !uuid.test(value))) throw new HttpError(400, "Mapeamento inválido.");
      const { data: result, error } = await client.rpc("transfer_delete_kanban", { p_actor_id: actorId, p_source_id: sourceId, p_destination_id: destinationId, p_mapping: data.mapping });
      if (error) throw new HttpError(409, "Transferência não concluída. Atualize os dados e confira o destino e as colunas de conclusão para tarefas arquivadas.");
      return reply(200, { success: true, ...result });
    } catch (error) {
      return error instanceof HttpError ? reply(error.status, { error: error.message }) : reply(500, { error: "Não foi possível concluir a operação." });
    }
  };
}

export async function cleanupStorage(client: SupabaseClient) {
  const { data: jobs, error } = await client.rpc("claim_task_storage_cleanup");
  if (error) throw new HttpError(503, "Limpeza de arquivos indisponível.");
  let completed = 0;
  for (const job of jobs ?? []) {
    // A restored task UUID must never lose its files.
    const { data: task, error: taskError } = await client.from("tasks").select("id").eq("id", job.task_id).maybeSingle();
    if (taskError || task) continue;
    let failed = false;
    // Uploads use exactly <task UUID>/<filename>; never follow arbitrary URLs.
    for (let batch = 0; batch <= 50; batch++) {
      if (batch === 50) { failed = true; break; }
      const { data: files, error: listError } = await client.storage.from("comment-images").list(job.task_id, { limit: 100 });
      if (listError) { failed = true; break; }
      if (!files?.length) break;
      if (files.some((file) => !file.id || file.name.includes("/"))) { failed = true; break; }
      const { error: removeError } = await client.storage.from("comment-images").remove(files.map((file) => `${job.task_id}/${file.name}`));
      if (removeError) { failed = true; break; }
    }
    if (!failed) {
      const { error: doneError } = await client.from("task_storage_cleanup").delete().eq("task_id", job.task_id);
      if (!doneError) completed++;
    }
  }
  return { completed, pending: (jobs?.length ?? 0) - completed };
}
