import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const directory = new URL("../supabase/migrations/", import.meta.url);
const ids = Array.from({ length: 6 }, (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
const roles = ["supervisor_geral", "supervisor_adjunto", "tecnico", "estagiario", "comercial", "financeiro"];
describe("administrative database transactions and authorization", () => {
  let db: PGlite;
  let principal: string;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
      GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid,bucket_id text,name text);
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated,anon,service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO authenticated,service_role;`);
    for (const file of readdirSync(directory).sort().filter((file) => file.endsWith(".sql"))) await db.exec(readFileSync(new URL(file, directory), "utf8"));
    for (const [i, role] of roles.entries()) {
      await db.query("INSERT INTO auth.users VALUES($1)", [ids[i]]);
      await db.query("INSERT INTO public.users(id,name,email,role,department) VALUES($1,$2,$3,$4,'suporte')", [ids[i], role, `${role}@example.test`, role]);
    }
    principal = (await db.query<{ id: string }>("SELECT id FROM kanbans WHERE slug='principal'")).rows[0].id;
  });
  afterAll(async () => { await db.close(); });
  async function actor(index: number | null, role = "authenticated") {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [index === null ? "" : ids[index]]);
    await db.exec(`SET ROLE ${role}`);
  }
  async function board(slug: string) {
    await actor(null, "service_role");
    const id = (await db.query<{ id: string }>("INSERT INTO kanbans(name,slug) VALUES($1,$1) RETURNING id", [slug])).rows[0].id;
    const columns = [];
    for (const kind of ["normal", "completed", "blocked"]) columns.push((await db.query<{ id: string }>("INSERT INTO kanban_columns(kanban_id,key,name,kind,position) VALUES($1,$2,$2,$2,$3) RETURNING id", [id, kind, columns.length])).rows[0].id);
    return { id, columns };
  }
  async function task(parent: { id: string; columns: string[] }, index = 0, archived = false) {
    const row = (await db.query<{ id: string }>("INSERT INTO tasks(kanban_id,column_id,title,department,creator_id,archived,archived_at,id_rfc,tags) VALUES($1,$2,'preservar','suporte',$3,$4,CASE WHEN $4 THEN now() ELSE NULL END,42,ARRAY['original']) RETURNING id", [parent.id, parent.columns[index], ids[0], archived])).rows[0];
    await db.query("INSERT INTO comments(task_id,user_id,content,image_url) VALUES($1,$2,'comentário','https://example.test/arquivo.png')", [row.id, ids[0]]);
    await db.query("INSERT INTO activity_logs(task_id,user_id,action,details) VALUES($1,$2,'created','histórico')", [row.id, ids[0]]);
    await db.query("INSERT INTO notifications(user_id,title,message,type,task_id) VALUES($1,'aviso','preservar','task_assigned',$2)", [ids[0], row.id]);
    return row.id;
  }
  it("denies direct REST-equivalent deletion, privileged RPCs and member inserts for all six roles", async () => {
    for (let i = 0; i < roles.length; i++) {
      await actor(i);
      await expect(db.query("DELETE FROM kanbans WHERE id=$1", [principal])).rejects.toThrow(/permission denied/);
      await expect(db.query("SELECT transfer_delete_kanban($1,$2,NULL,'{}')", [ids[i], principal])).rejects.toThrow(/permission denied/);
      await expect(db.query("SELECT reserve_kanban_delete_attempt($1)", [ids[i]])).rejects.toThrow(/permission denied/);
      await expect(db.exec("SELECT * FROM task_storage_cleanup")).rejects.toThrow(/permission denied/);
      await expect(db.query("INSERT INTO users(id,name,email,role,department) VALUES($1,'x','x@example.test','supervisor_geral','suporte')", [ids[i]])).rejects.toThrow(/row-level security/);
    }
    await actor(null, "anon");
    await expect(db.query("SELECT delete_task_with_cleanup($1,$1)", [principal])).rejects.toThrow(/permission denied/);
  });
  it("deletes active, completed and archived tasks, cascades relations, nulls notifications and enqueues files", async () => {
    const parent = await board("individual");
    for (const [index, archived] of [[0, false], [1, false], [1, true]] as const) {
      await actor(null, "service_role"); const id = await task(parent, index, archived);
      await actor(2); await expect(db.query("SELECT delete_task_with_cleanup($1,$2)", [id, parent.id])).rejects.toThrow(/supervisores/);
      await actor(1); await expect(db.query("SELECT delete_task_with_cleanup($1,$2)", [id, principal])).rejects.toThrow(/Kanban incorreto/);
      expect((await db.query("SELECT delete_task_with_cleanup($1,$2) AS id", [id, parent.id])).rows[0].id).toBe(id);
      await expect(db.query("SELECT delete_task_with_cleanup($1,$2)", [id, parent.id])).rejects.toThrow(/removida/);
      expect((await db.query("SELECT * FROM comments WHERE task_id=$1", [id])).rows).toHaveLength(0);
      expect((await db.query("SELECT * FROM activity_logs WHERE task_id=$1", [id])).rows).toHaveLength(0);
      await actor(null, "service_role");
      expect((await db.query("SELECT * FROM task_storage_cleanup WHERE task_id=$1", [id])).rows).toHaveLength(1);
      expect((await db.query("SELECT * FROM admin_audit WHERE details->>'task_id'=$1", [id])).rows).toHaveLength(1);
    }
    expect((await db.query("SELECT * FROM notifications WHERE task_id IS NULL")).rows).toHaveLength(3);
  });
  it("moves column tasks without changing identity or relations; rejects foreign destinations atomically", async () => {
    const parent = await board("colunas"); const other = await board("estranho");
    await actor(null, "service_role"); const id = await task(parent);
    const snapshot = (await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0];
    await actor(0);
    await expect(db.query("SELECT delete_column_with_tasks($1,$2,'transfer',$3)", [parent.columns[0], parent.id, other.columns[0]])).rejects.toThrow(/mesmo Kanban/);
    expect((await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0]).toEqual(snapshot);
    await db.query("SELECT delete_column_with_tasks($1,$2,'transfer',$3)", [parent.columns[0], parent.id, parent.columns[1]]);
    expect((await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0]).toMatchObject({ ...snapshot, column_id: parent.columns[1], status: "completed", updated_at: expect.any(Date) });
    expect((await db.query("SELECT * FROM comments WHERE task_id=$1", [id])).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM kanban_columns WHERE id=$1", [parent.columns[0]])).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM kanban_columns WHERE kanban_id=$1", [other.id])).rows).toHaveLength(3);
  });
  it("rejects archived column transfers, preserves movement permissions and deletes all tasks transactionally", async () => {
    const parent = await board("arquivadas"); await actor(null, "service_role");
    const id = await task(parent, 1, true); const other = await task(parent, 1);
    await actor(1);
    await expect(db.query("SELECT delete_column_with_tasks($1,$2,'transfer',$3)", [parent.columns[1], parent.id, parent.columns[0]])).rejects.toThrow(/arquivadas/);
    expect((await db.query("SELECT * FROM tasks WHERE column_id=$1", [parent.columns[1]])).rows).toHaveLength(2);
    await db.query("SELECT delete_column_with_tasks($1,$2,'delete',NULL)", [parent.columns[1], parent.id]);
    expect((await db.query("SELECT * FROM tasks WHERE id IN ($1,$2)", [id, other])).rows).toHaveLength(0);
    await db.query("SELECT delete_column_with_tasks($1,$2,'delete',NULL)", [parent.columns[0], parent.id]);
    await actor(2);
    await expect(db.query("SELECT delete_column_with_tasks($1,$2,'delete',NULL)", [parent.columns[2], parent.id])).rejects.toThrow(/supervisores/);
  });
  it("rolls back task cascades, outbox and audit when a later deletion step fails", async () => {
    const parent = await board("rollback"); await actor(null, "service_role"); const id = await task(parent);
    await actor(null, "postgres");
    await db.exec("CREATE FUNCTION public.fail_column_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated failure'; END $$; CREATE TRIGGER zz_fail_column BEFORE DELETE ON kanban_columns FOR EACH ROW EXECUTE FUNCTION fail_column_test();");
    await actor(0);
    await expect(db.query("SELECT delete_column_with_tasks($1,$2,'delete',NULL)", [parent.columns[0], parent.id])).rejects.toThrow(/simulated/);
    expect((await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM comments WHERE task_id=$1", [id])).rows).toHaveLength(1);
    await actor(null, "postgres"); await db.exec("DROP TRIGGER zz_fail_column ON kanban_columns; DROP FUNCTION fail_column_test();");
    expect((await db.query("SELECT * FROM task_storage_cleanup WHERE task_id=$1", [id])).rows).toHaveLength(0);
  });
  it("transfers a whole Kanban including archives and multiple sources to one target; preserves every other field and relationship", async () => {
    const source = await board("origem"); const destination = await board("destino"); const third = await board("terceiro");
    await actor(null, "service_role"); const taskIds = [await task(source), await task(source, 1, true), await task(source, 2)];
    const snapshots = (await db.query("SELECT * FROM tasks WHERE kanban_id=$1 ORDER BY id", [source.id])).rows;
    const mapping = Object.fromEntries(source.columns.map((id) => [id, destination.columns[1]]));
    await expect(db.query("SELECT transfer_delete_kanban($1,$2,$3,$4)", [ids[1], source.id, destination.id, { ...mapping, [source.columns[0]]: third.columns[0] }])).rejects.toThrow(/Mapeie/);
    await expect(db.query("SELECT transfer_delete_kanban($1,$2,$3,$4)", [ids[1], source.id, destination.id, { ...mapping, [source.columns[1]]: destination.columns[0] }])).rejects.toThrow(/arquivadas/);
    expect((await db.query("SELECT * FROM tasks WHERE kanban_id=$1 ORDER BY id", [source.id])).rows).toEqual(snapshots);
    await db.query("SELECT transfer_delete_kanban($1,$2,$3,$4)", [ids[1], source.id, destination.id, mapping]);
    const moved = (await db.query("SELECT * FROM tasks WHERE id=ANY($1) ORDER BY id", [taskIds])).rows;
    expect(moved).toEqual(snapshots.map((row) => ({ ...row, kanban_id: destination.id, column_id: destination.columns[1], status: "completed", updated_at: expect.any(Date) })));
    expect((await db.query("SELECT * FROM comments WHERE task_id=ANY($1)", [taskIds])).rows).toHaveLength(3);
    expect((await db.query("SELECT * FROM activity_logs WHERE task_id=ANY($1)", [taskIds])).rows).toHaveLength(3);
    expect((await db.query("SELECT * FROM notifications WHERE task_id=ANY($1)", [taskIds])).rows).toHaveLength(3);
    expect((await db.query("SELECT * FROM kanbans WHERE id=$1", [source.id])).rows).toHaveLength(0);
    expect((await db.query("SELECT * FROM kanban_columns WHERE kanban_id=$1", [third.id])).rows).toHaveLength(3);
  });
  it("rejects missing mappings, same-board destinations, non-supervisors and user JWTs even on backend calls", async () => {
    const source = await board("invalidos"); await actor(null, "service_role"); await task(source);
    await expect(db.query("SELECT transfer_delete_kanban($1,$2,$2,'{}')", [ids[0], source.id])).rejects.toThrow(/outro Kanban/);
    await expect(db.query("SELECT transfer_delete_kanban($1,$2,$3,'{}')", [ids[0], source.id, principal])).rejects.toThrow(/Mapeie/);
    await expect(db.query("SELECT transfer_delete_kanban($1,$2,NULL,'{}')", [ids[2], source.id])).rejects.toThrow(/Backend/);
    await actor(0, "service_role");
    await expect(db.query("SELECT transfer_delete_kanban($1,$2,NULL,'{}')", [ids[0], source.id])).rejects.toThrow(/Backend/);
  });
  it("allows empty Kanban deletion on backend and applies a persistent five-attempt limit", async () => {
    const empty = await board("vazio"); await actor(null, "service_role");
    await db.query("SELECT transfer_delete_kanban($1,$2,NULL,'{}')", [ids[0], empty.id]);
    for (let i = 0; i < 5; i++) expect((await db.query("SELECT reserve_kanban_delete_attempt($1) AS allowed", [ids[0]])).rows[0].allowed).toBe(true);
    expect((await db.query("SELECT reserve_kanban_delete_attempt($1) AS allowed", [ids[0]])).rows[0].allowed).toBe(false);
    await db.query("UPDATE admin_action_limits SET window_start=now()-interval '16 minutes' WHERE actor_id=$1", [ids[0]]);
    expect((await db.query("SELECT reserve_kanban_delete_attempt($1) AS allowed", [ids[0]])).rows[0].allowed).toBe(true);
  });

  it("rolls back a whole Kanban transfer if deleting the parent fails", async () => {
    const source = await board("rollback-kanban"); const destination = await board("rollback-destino");
    await actor(null, "service_role"); await task(source, 1, true);
    const tasks = (await db.query("SELECT * FROM tasks WHERE kanban_id=$1", [source.id])).rows;
    const columns = (await db.query("SELECT * FROM kanban_columns WHERE kanban_id=$1 ORDER BY id", [source.id])).rows;
    await actor(null, "postgres");
    await db.exec("CREATE FUNCTION public.fail_kanban_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated parent failure'; END $$; CREATE TRIGGER zz_fail_kanban BEFORE DELETE ON kanbans FOR EACH ROW EXECUTE FUNCTION fail_kanban_test();");
    await actor(null, "service_role");
    await expect(db.query("SELECT transfer_delete_kanban($1,$2,$3,$4)", [ids[0], source.id, destination.id, Object.fromEntries(source.columns.map((column) => [column, destination.columns[1]]))])).rejects.toThrow(/simulated parent/);
    expect((await db.query("SELECT * FROM tasks WHERE kanban_id=$1", [source.id])).rows).toEqual(tasks);
    expect((await db.query("SELECT * FROM kanban_columns WHERE kanban_id=$1 ORDER BY id", [source.id])).rows).toEqual(columns);
    expect((await db.query("SELECT * FROM admin_audit WHERE details->>'source_id'=$1", [source.id])).rows).toHaveLength(0);
    await actor(null, "postgres"); await db.exec("DROP TRIGGER zz_fail_kanban ON kanbans; DROP FUNCTION fail_kanban_test();");
  });

  it("holds mutation-conflicting table locks until commit and retains normal adjunct movement rules", async () => {
    const parent = await board("concorrencia"); await actor(null, "service_role"); const id = await task(parent);
    await actor(1);
    await expect(db.query("SELECT delete_column_with_tasks($1,$2,'transfer',$3)", [parent.columns[0], parent.id, parent.columns[2]])).rejects.toThrow(/Movimento/);
    expect((await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0].column_id).toBe(parent.columns[0]);
    await db.exec("BEGIN");
    try {
      await db.query("SELECT delete_column_with_tasks($1,$2,'transfer',$3)", [parent.columns[0], parent.id, parent.columns[1]]);
      const locks = (await db.query("SELECT c.relname FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE l.mode='ShareRowExclusiveLock' AND l.granted ORDER BY c.relname")).rows;
      expect(locks.map((row) => row.relname)).toEqual(["kanban_columns", "kanbans", "tasks"]);
    } finally { await db.exec("ROLLBACK"); }
    expect((await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0].column_id).toBe(parent.columns[0]);
  });

  it("renames and recolors status metadata without rewriting task identity, archive state or timestamps", async () => {
    const parent = await board("status-metadata"); await actor(null, "service_role"); const id = await task(parent, 1, true);
    const before = (await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0];
    const column = (await db.query("SELECT id,key FROM kanban_columns WHERE id=$1", [parent.columns[1]])).rows[0];
    for (const index of [0, 1]) {
      await actor(index);
      const updated = (await db.query("UPDATE kanban_columns SET name='Entregue',color='#8844CC' WHERE id=$1 RETURNING id,key,kind", [parent.columns[1]])).rows[0];
      expect(updated).toEqual({ ...column, kind: "completed" });
      expect((await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0]).toEqual(before);
      await expect(db.query("UPDATE kanban_columns SET kind='normal' WHERE id=$1", [parent.columns[1]])).rejects.toMatchObject({ code: "23514" });
    }
    for (const index of [2, 3, 4, 5]) {
      await actor(index);
      expect((await db.query("UPDATE kanban_columns SET name='Denied' WHERE id=$1 RETURNING id", [parent.columns[1]])).rows).toEqual([]);
    }
  });

  it("enforces status key and functional-kind uniqueness within each Kanban", async () => {
    const first = await board("status-first"); const second = await board("status-second"); await actor(0);
    await db.query("INSERT INTO kanban_columns(kanban_id,key,name,kind) VALUES($1,'custom','Custom','normal'),($2,'custom','Custom','normal')", [first.id, second.id]);
    await expect(db.query("INSERT INTO kanban_columns(kanban_id,key,name) VALUES($1,'custom','Duplicate')", [first.id])).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("UPDATE kanban_columns SET kind='completed' WHERE id=$1", [first.columns[0]])).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("UPDATE kanban_columns SET kind='blocked' WHERE id=$1", [first.columns[0]])).rejects.toMatchObject({ code: "23505" });
    expect((await db.query("SELECT key FROM kanban_columns WHERE kanban_id=$1 AND key='custom'", [second.id])).rows).toHaveLength(1);
  });

  it("allows functional changes for unarchived tasks without rewriting their fields", async () => {
    const parent = await board("status-function"); await actor(null, "service_role"); const id = await task(parent, 1);
    const before = (await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0];
    await actor(1);
    await db.query("UPDATE kanban_columns SET kind='normal' WHERE id=$1", [parent.columns[1]]);
    expect((await db.query("SELECT kind FROM kanban_columns WHERE id=$1", [parent.columns[1]])).rows[0]).toEqual({ kind: "normal" });
    expect((await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0]).toEqual(before);
    await db.query("UPDATE kanban_columns SET kind='completed' WHERE id=$1", [parent.columns[1]]);
    expect((await db.query("SELECT * FROM tasks WHERE id=$1", [id])).rows[0]).toEqual(before);
  });

  it("rejects orphan image uploads and allows an existing task's UUID prefix", async () => {
    const parent = await board("arquivos"); await actor(null, "service_role"); const id = await task(parent);
    await actor(null, "postgres");
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('comment-images',$1)", [`${id}/image.png`]);
    await expect(db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('comment-images','missing-task/image.png')")).rejects.toThrow(/tarefa do arquivo/);
    await actor(0); await db.query("SELECT delete_task_with_cleanup($1,$2)", [id, parent.id]);
    await actor(null, "postgres");
    await expect(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('comment-images',$1)", [`${id}/late.png`])).rejects.toThrow(/tarefa do arquivo/);
  });
});
