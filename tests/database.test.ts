import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const migration = readFileSync(new URL("20261007000000_multi_kanban.sql", migrationsDir), "utf8");
const roles = ["supervisor_geral", "supervisor_adjunto", "tecnico", "estagiario", "comercial", "financeiro"];
const userId = (index: number) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

async function legacyDatabase() {
  const db = new PGlite();
  // Only the Supabase-owned auth/storage schemas are fixtures. All application SQL
  // (including historical migrations, policies and triggers) runs unchanged.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
    GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid, bucket_id text, name text);
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/') $$;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
  `);
  for (const filename of readdirSync(migrationsDir).sort().filter((file) => file.endsWith(".sql") && file < "20261007000000")) {
    await db.exec(readFileSync(new URL(filename, migrationsDir), "utf8"));
  }
  for (const [index, role] of roles.entries()) {
    await db.query("INSERT INTO auth.users VALUES ($1)", [userId(index)]);
    await db.query("INSERT INTO public.users(id,name,email,role,department) VALUES ($1,$2,$3,$4,'suporte')", [userId(index), role, `${role}@example.test`, role]);
  }
  return db;
}

async function asUser(db: PGlite, index: number) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId(index)]);
  await db.exec("SET ROLE authenticated");
}

describe("multi-Kanban migration on an existing installation", () => {
  let db: PGlite;
  let previousTasks: Record<string, unknown>[];
  let previousColumns: Record<string, unknown>[];
  let related: Record<string, unknown>[][];
  let principal: string;
  let second: string;
  let finalColumn: string;
  let blockedColumn: string;
  let taskId: string;

  beforeAll(async () => {
    db = await legacyDatabase();
    await db.exec("INSERT INTO boards(key,name,color,position) VALUES ('personalizada','Coluna personalizada','#123456',8)");
    for (const status of ["novo", "em_andamento", "em_revisao", "concluido", "bloqueado", "personalizada", "coluna-removida"]) {
      await db.query("INSERT INTO tasks(title,status,department,creator_id,archived,archived_at,id_rfc) VALUES ($1,$1,'suporte',$2,$3,CASE WHEN $3 THEN now() ELSE NULL END,123)", [status, userId(0), status === "concluido"]);
    }
    const oldTask = (await db.query<{ id: string }>("SELECT id FROM tasks LIMIT 1")).rows[0].id;
    await db.query("INSERT INTO comments(task_id,user_id,content,image_url) VALUES ($1,$2,'preservado','https://example.test/image.png')", [oldTask, userId(0)]);
    await db.query("INSERT INTO activity_logs(task_id,user_id,action,details) VALUES ($1,$2,'created','preservado')", [oldTask, userId(0)]);
    await db.query("INSERT INTO notifications(task_id,user_id,title,message,type) VALUES ($1,$2,'preservado','preservado','mention')", [oldTask, userId(0)]);
    previousTasks = (await db.query("SELECT * FROM tasks ORDER BY id")).rows;
    previousColumns = (await db.query("SELECT * FROM boards ORDER BY id")).rows;
    related = await Promise.all(["comments", "activity_logs", "notifications"].map(async (table) => (await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows));
    await db.exec(migration);
    principal = (await db.query<{ id: string }>("SELECT id FROM kanbans WHERE slug='principal'")).rows[0].id;
  });
  afterAll(async () => { await db?.close(); });

  it("preserves all task UUIDs, fields, archives, comments, images, activity and notifications", async () => {
    const tasks = (await db.query("SELECT * FROM tasks ORDER BY id")).rows;
    expect(tasks.map(({ kanban_id, column_id, ...old }) => {
      expect(kanban_id).toBe(principal); expect(column_id).toBeTruthy(); return old;
    })).toEqual(previousTasks);
    for (const [index, table] of ["comments", "activity_logs", "notifications"].entries()) {
      expect((await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows).toEqual(related[index]);
    }
  });

  it("preserves old columns and recovers orphaned statuses without dropping tasks", async () => {
    for (const old of previousColumns) {
      const row = (await db.query("SELECT * FROM kanban_columns WHERE id=$1", [old.id])).rows[0];
      expect(row).toMatchObject({ ...old, kanban_id: principal });
      expect(row.kind).toBe(old.key === "concluido" ? "completed" : old.key === "bloqueado" ? "blocked" : "normal");
    }
    expect((await db.query("SELECT t.id FROM tasks t JOIN kanban_columns c ON c.id=t.column_id AND c.kanban_id=t.kanban_id WHERE c.key=t.status")).rows).toHaveLength(7);
    expect((await db.query("SELECT name FROM kanban_columns WHERE key='coluna-removida'")).rows[0]).toEqual({ name: "coluna-removida" });
  });

  it("allows supervisors to create an independent workflow and task with arbitrary keys", async () => {
    await asUser(db, 0);
    second = (await db.query<{ id: string }>("SELECT * FROM create_kanban('Desenvolvimento','desenvolvimento','#123456')")).rows[0].id;
    finalColumn = (await db.query<{ id: string }>("INSERT INTO kanban_columns(kanban_id,key,name,color,kind,position) VALUES ($1,'finalizado','Finalizado','#22C55E','completed',2) RETURNING id", [second])).rows[0].id;
    blockedColumn = (await db.query<{ id: string }>("INSERT INTO kanban_columns(kanban_id,key,name,color,kind,position) VALUES ($1,'impedido','Impedido','#EF4444','blocked',3) RETURNING id", [second])).rows[0].id;
    taskId = (await db.query<{ id: string }>("INSERT INTO tasks(title,department,creator_id,kanban_id,column_id) VALUES ('Independente','suporte',$1,$2,$3) RETURNING id", [userId(0), second, finalColumn])).rows[0].id;
    expect((await db.query("SELECT id FROM tasks WHERE kanban_id=$1", [principal])).rows).toHaveLength(7);
    expect((await db.query("SELECT id FROM tasks WHERE kanban_id=$1", [second])).rows).toEqual([{ id: taskId }]);
    expect((await db.query("SELECT status FROM tasks WHERE id=$1", [taskId])).rows[0]).toEqual({ status: "finalizado" });
  });

  it("rejects cross-Kanban links, duplicate slugs, duplicate kinds and duplicate local keys", async () => {
    await expect(db.query("UPDATE tasks SET column_id=$1 WHERE kanban_id=$2", [finalColumn, principal])).rejects.toMatchObject({ code: "23503" });
    await expect(db.exec("SELECT create_kanban('Duplicado','principal','#123456')")).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("INSERT INTO kanban_columns(kanban_id,key,name,color,kind) VALUES ($1,'outra','Outra','#123456','completed')", [second])).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("INSERT INTO kanban_columns(kanban_id,key,name,color,kind) VALUES ($1,'outra','Outra','#123456','blocked')", [second])).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("INSERT INTO kanban_columns(kanban_id,key,name,color) VALUES ($1,'aberto','Duplicada','#123456')", [second])).rejects.toMatchObject({ code: "23505" });
    await db.query("INSERT INTO kanban_columns(kanban_id,key,name,color,position) VALUES ($1,'novo','Mesmo key, outro Kanban','#123456',1)", [second]);
  });

  it("archives by completed kind, restores the same links, and blocks deleting archived tasks' parents", async () => {
    await db.query("UPDATE tasks SET archived=true,archived_at=now() WHERE id=$1", [taskId]);
    await expect(db.query("DELETE FROM kanbans WHERE id=$1", [second])).rejects.toMatchObject({ code: "23503" });
    await expect(db.query("DELETE FROM kanban_columns WHERE id=$1", [finalColumn])).rejects.toMatchObject({ code: "23503" });
    await expect(db.query("UPDATE kanban_columns SET kind='normal' WHERE id=$1", [finalColumn])).rejects.toMatchObject({ code: "23514" });
    await db.query("UPDATE tasks SET archived=false,archived_at=NULL WHERE id=$1", [taskId]);
    expect((await db.query("SELECT kanban_id,column_id FROM tasks WHERE id=$1", [taskId])).rows[0]).toEqual({ kanban_id: second, column_id: finalColumn });
    await db.query("UPDATE tasks SET column_id=$1 WHERE id=$2", [blockedColumn, taskId]);
    await expect(db.query("UPDATE tasks SET archived=true WHERE id=$1", [taskId])).rejects.toMatchObject({ code: "23514" });
  });

  it("reorders atomically and rejects stale, foreign, duplicated and null ID lists", async () => {
    const ids = (await db.query<{ id: string }>("SELECT id FROM kanban_columns WHERE kanban_id=$1 ORDER BY position,id", [second])).rows.map((row) => row.id);
    await db.query("SELECT reorder_kanban_columns($1,$2::uuid[])", [second, [...ids].reverse()]);
    expect((await db.query<{ id: string }>("SELECT id FROM kanban_columns WHERE kanban_id=$1 ORDER BY position,id", [second])).rows.map((row) => row.id)).toEqual([...ids].reverse());
    const snapshot = (await db.query("SELECT id,position FROM kanban_columns ORDER BY id")).rows;
    for (const invalid of [ids.slice(1), ids.map(() => ids[0]), [...ids.slice(1), userId(0)], null]) {
      await expect(db.query("SELECT reorder_kanban_columns($1,$2::uuid[])", [second, invalid])).rejects.toMatchObject({ code: "22023" });
    }
    await expect(db.query("SELECT reorder_kanbans($1::uuid[])", [[principal, userId(0)]])).rejects.toMatchObject({ code: "22023" });
    await db.query("SELECT reorder_kanbans($1::uuid[])", [[second, principal]]);
    expect((await db.query("SELECT id,position FROM kanban_columns ORDER BY id")).rows).toEqual(snapshot);
    // Restore workflow positions for the permission scenarios.
    await db.query("SELECT reorder_kanban_columns($1,$2::uuid[])", [second, ids]);
  });

  it.each([1, 2, 3, 4, 5])("enforces role %i through direct SQL and RPCs", async (index) => {
    await asUser(db, index);
    expect((await db.exec("SELECT * FROM kanbans"))[0].rows).toHaveLength(2);
    if (index === 1) {
      await db.query("UPDATE kanbans SET name='Desenvolvimento' WHERE id=$1", [second]);
      await db.query("UPDATE kanban_columns SET name='Impedido' WHERE id=$1", [blockedColumn]);
      await expect(db.query("UPDATE tasks SET column_id=$1 WHERE id=$2", [blockedColumn, taskId])).resolves.toBeTruthy(); // same column
      await db.query("UPDATE tasks SET column_id=$1 WHERE id=$2", [finalColumn, taskId]);
      await expect(db.query("UPDATE tasks SET column_id=$1 WHERE id=$2", [blockedColumn, taskId])).rejects.toMatchObject({ code: "42501" });
    } else {
      await expect(db.query("UPDATE users SET role='supervisor_geral' WHERE id=$1", [userId(index)])).rejects.toMatchObject({ code: "42501" });
      await db.query("UPDATE users SET name='Perfil editável' WHERE id=$1", [userId(index)]);
      await expect(db.exec("SELECT create_kanban('Negado','negado','#123456')")).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("INSERT INTO kanbans(name,slug,color,created_by) VALUES ('Negado','negado','#123456',$1)", [userId(index)])).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("INSERT INTO kanban_columns(kanban_id,key,name,color) VALUES ($1,'negado','Negado','#123456')", [second])).rejects.toMatchObject({ code: "42501" });
      expect((await db.query("UPDATE kanbans SET name='Negado' WHERE id=$1 RETURNING id", [second])).rows).toEqual([]);
      expect((await db.query("DELETE FROM kanbans WHERE id=$1 RETURNING id", [second])).rows).toEqual([]);
      expect((await db.query("UPDATE kanban_columns SET name='Negado' WHERE id=$1 RETURNING id", [finalColumn])).rows).toEqual([]);
      expect((await db.query("DELETE FROM kanban_columns WHERE id=$1 RETURNING id", [finalColumn])).rows).toEqual([]);
      await expect(db.query("SELECT reorder_kanbans($1::uuid[])", [[second, principal]])).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("SELECT reorder_kanban_columns($1,$2::uuid[])", [second, []])).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("UPDATE tasks SET title='Negado' WHERE id=$1", [taskId])).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("UPDATE tasks SET archived=true WHERE id=$1", [taskId])).rejects.toMatchObject({ code: "42501" });
    }
  });

  it("enforces generic creation, forward movement and blocked escape for ordinary users", async () => {
    await asUser(db, 2);
    expect((await db.query<{ allowed: boolean }>("SELECT can_create_in_kanban_column($1) AS allowed", [finalColumn])).rows[0].allowed).toBe(true);
    expect((await db.query<{ allowed: boolean }>("SELECT can_create_in_kanban_column($1) AS allowed", [blockedColumn])).rows[0].allowed).toBe(false);
    await expect(db.query("INSERT INTO tasks(title,department,creator_id,kanban_id,column_id) VALUES ('Negado','suporte',$1,$2,$3)", [userId(2), second, blockedColumn])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("INSERT INTO tasks(title,department,creator_id,kanban_id,column_id,archived) VALUES ('Negado','suporte',$1,$2,$3,true)", [userId(2), second, finalColumn])).rejects.toMatchObject({ code: "42501" });
    const ordinaryTask = (await db.query<{ id: string }>("INSERT INTO tasks(title,department,creator_id,kanban_id,column_id) VALUES ('Técnico','suporte',$1,$2,$3) RETURNING id", [userId(2), second, finalColumn])).rows[0].id;
    const initial = (await db.query<{ id: string }>("SELECT id FROM kanban_columns WHERE kanban_id=$1 AND position=0", [second])).rows[0].id;
    await expect(db.query("UPDATE tasks SET column_id=$1 WHERE id=$2", [initial, ordinaryTask])).rejects.toMatchObject({ code: "42501" });
    await db.query("UPDATE tasks SET column_id=$1 WHERE id=$2", [blockedColumn, ordinaryTask]);
    await db.query("UPDATE tasks SET column_id=$1 WHERE id=$2", [initial, ordinaryTask]);
    await db.query("UPDATE tasks SET title='Criador pode editar' WHERE id=$1", [ordinaryTask]);
  });

  it("does not expose new metadata or task writes to anonymous users", async () => {
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SET ROLE anon;");
    expect((await db.query("SELECT * FROM kanbans")).rows).toEqual([]);
    expect((await db.query("SELECT * FROM kanban_columns")).rows).toEqual([]);
    expect((await db.query("SELECT * FROM tasks")).rows).toEqual([]);
    await expect(db.exec("SELECT create_kanban('Negado','negado','#123456')")).rejects.toMatchObject({ code: "42501" });
  });
});

it("also applies the entire migration chain to a fresh installation", async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(migration);
    expect((await db.query("SELECT slug,name FROM kanbans")).rows).toEqual([{ slug: "principal", name: "Principal" }]);
    expect((await db.query("SELECT * FROM tasks")).rows).toEqual([]);
    expect((await db.query("SELECT kind FROM kanban_columns WHERE kind <> 'normal' ORDER BY kind")).rows).toEqual([{ kind: "blocked" }, { kind: "completed" }]);
  } finally { await db.close(); }
});

it("recovers removed legacy completed/blocked columns with their functional kinds", async () => {
  const db = await legacyDatabase();
  try {
    await db.query("INSERT INTO tasks(title,status,department,creator_id,archived) VALUES ('Arquivo','concluido','suporte',$1,true),('Bloqueio','bloqueado','suporte',$1,false)", [userId(0)]);
    await db.exec("DELETE FROM boards WHERE key IN ('concluido','bloqueado')");
    await db.exec(migration);
    expect((await db.query("SELECT c.kind FROM tasks t JOIN kanban_columns c ON c.id=t.column_id ORDER BY c.kind")).rows).toEqual([{ kind: "blocked" }, { kind: "completed" }]);
  } finally { await db.close(); }
});
