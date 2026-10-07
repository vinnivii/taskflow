-- Run before deploying the multi-Kanban frontend. No tasks or relationships are deleted.
BEGIN;
LOCK TABLE public.boards, public.tasks IN ACCESS EXCLUSIVE MODE;

CREATE TABLE public.kanbans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  color text NOT NULL DEFAULT '#3B82F6' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.kanbans (slug, name, color, position)
VALUES ('principal', 'Principal', '#F2C94C', 0);

-- Renaming preserves every existing column UUID, name, color, position and timestamp.
ALTER TABLE public.boards RENAME TO kanban_columns;
ALTER TABLE public.kanban_columns
  ADD COLUMN kanban_id uuid,
  ADD COLUMN kind text NOT NULL DEFAULT 'normal'
    CHECK (kind IN ('normal', 'completed', 'blocked'));

UPDATE public.kanban_columns
SET kanban_id = (SELECT id FROM public.kanbans WHERE slug = 'principal'),
    kind = CASE key WHEN 'concluido' THEN 'completed'
                    WHEN 'bloqueado' THEN 'blocked' ELSE 'normal' END;

ALTER TABLE public.kanban_columns
  ALTER COLUMN kanban_id SET NOT NULL,
  DROP CONSTRAINT boards_key_key,
  ADD CONSTRAINT kanban_columns_kanban_fk FOREIGN KEY (kanban_id)
    REFERENCES public.kanbans(id) ON DELETE CASCADE,
  ADD CONSTRAINT kanban_columns_kanban_key_unique UNIQUE (kanban_id, key),
  ADD CONSTRAINT kanban_columns_id_kanban_unique UNIQUE (id, kanban_id);

-- Recover statuses whose original column was removed, rather than losing or hiding tasks.
INSERT INTO public.kanban_columns (kanban_id, key, name, color, kind, position)
SELECT k.id, missing.status, coalesce(nullif(btrim(missing.status), ''), 'Status sem nome'),
       '#8A8A8A', CASE missing.status WHEN 'concluido' THEN 'completed'
                                    WHEN 'bloqueado' THEN 'blocked' ELSE 'normal' END,
       positions.last_position + row_number() OVER (ORDER BY missing.status)::integer
FROM public.kanbans k
CROSS JOIN (
  SELECT DISTINCT t.status FROM public.tasks t
  WHERE NOT EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.key = t.status)
) missing
CROSS JOIN (SELECT coalesce(max(position), -1) AS last_position FROM public.kanban_columns) positions
WHERE k.slug = 'principal';

ALTER TABLE public.tasks ADD COLUMN kanban_id uuid, ADD COLUMN column_id uuid;
UPDATE public.tasks t SET kanban_id = c.kanban_id, column_id = c.id
FROM public.kanban_columns c WHERE c.key = t.status;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.tasks WHERE kanban_id IS NULL OR column_id IS NULL) THEN
    RAISE EXCEPTION 'Multi-Kanban migration aborted: a task has no corresponding column';
  END IF;
END $$;

ALTER TABLE public.tasks
  ALTER COLUMN kanban_id SET NOT NULL,
  ALTER COLUMN column_id SET NOT NULL,
  ALTER COLUMN status DROP DEFAULT,
  ADD CONSTRAINT tasks_kanban_fk FOREIGN KEY (kanban_id)
    REFERENCES public.kanbans(id) ON DELETE RESTRICT,
  ADD CONSTRAINT tasks_column_kanban_fk FOREIGN KEY (column_id, kanban_id)
    REFERENCES public.kanban_columns(id, kanban_id) ON DELETE RESTRICT;

CREATE INDEX kanbans_created_by_idx ON public.kanbans(created_by);
CREATE INDEX kanban_columns_order_idx ON public.kanban_columns(kanban_id, position, id);
CREATE UNIQUE INDEX kanban_columns_one_completed ON public.kanban_columns(kanban_id) WHERE kind = 'completed';
CREATE UNIQUE INDEX kanban_columns_one_blocked ON public.kanban_columns(kanban_id) WHERE kind = 'blocked';
CREATE INDEX tasks_kanban_created_idx ON public.tasks(kanban_id, created_at DESC, id);
CREATE INDEX tasks_column_kanban_idx ON public.tasks(column_id, kanban_id);

ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS boards_select ON public.kanban_columns;
DROP POLICY IF EXISTS boards_insert ON public.kanban_columns;
DROP POLICY IF EXISTS boards_update ON public.kanban_columns;
DROP POLICY IF EXISTS boards_delete ON public.kanban_columns;

CREATE POLICY kanbans_select ON public.kanbans FOR SELECT TO authenticated USING (true);
CREATE POLICY kanbans_insert ON public.kanbans FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_supervisor()) AND created_by = (SELECT auth.uid()));
CREATE POLICY kanbans_update ON public.kanbans FOR UPDATE TO authenticated
  USING ((SELECT public.is_supervisor())) WITH CHECK ((SELECT public.is_supervisor()));
CREATE POLICY kanbans_delete ON public.kanbans FOR DELETE TO authenticated USING ((SELECT public.is_supervisor()));
CREATE POLICY kanban_columns_select ON public.kanban_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY kanban_columns_insert ON public.kanban_columns FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_supervisor()));
CREATE POLICY kanban_columns_update ON public.kanban_columns FOR UPDATE TO authenticated
  USING ((SELECT public.is_supervisor())) WITH CHECK ((SELECT public.is_supervisor()));
CREATE POLICY kanban_columns_delete ON public.kanban_columns FOR DELETE TO authenticated USING ((SELECT public.is_supervisor()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanbans, public.kanban_columns TO authenticated;

-- Kanban RLS trusts users.role. The legacy self-profile update policy must not
-- let an ordinary user grant themselves supervisory privileges. Avatar/name
-- updates and trusted backend administration keep working unchanged.
CREATE FUNCTION public.protect_user_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL AND NOT coalesce(
    (SELECT role = 'supervisor_geral' FROM public.users WHERE id = auth.uid()), false
  ) THEN
    RAISE EXCEPTION 'Somente o supervisor geral pode alterar papéis' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_protect_role BEFORE UPDATE OF role ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_role();

-- Generic column creation permissions: initial = first normal, work = second normal
-- (or the first when there is only one). This preserves the Principal workflow.
CREATE FUNCTION public.can_create_in_kanban_column(p_column_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH target AS (SELECT * FROM public.kanban_columns WHERE id = p_column_id),
  normal_columns AS (
    SELECT c.id, row_number() OVER (ORDER BY c.position, c.id) AS ordinal
    FROM public.kanban_columns c, target t WHERE c.kanban_id = t.kanban_id AND c.kind = 'normal'
  )
  SELECT coalesce((SELECT CASE
    WHEN u.role IN ('supervisor_geral', 'supervisor_adjunto') THEN true
    WHEN u.role = 'tecnico' THEN t.kind = 'completed' OR t.id = coalesce(
      (SELECT id FROM normal_columns WHERE ordinal = 2), (SELECT id FROM normal_columns WHERE ordinal = 1))
    WHEN u.role = 'estagiario' THEN t.id = coalesce(
      (SELECT id FROM normal_columns WHERE ordinal = 2), (SELECT id FROM normal_columns WHERE ordinal = 1))
    WHEN u.role IN ('comercial', 'financeiro') THEN t.id = (SELECT id FROM normal_columns WHERE ordinal = 1)
    ELSE false END
    FROM public.users u, target t WHERE u.id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.can_create_in_kanban_column(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_in_kanban_column(uuid) TO authenticated;

DROP POLICY tasks_insert ON public.tasks;
DROP POLICY tasks_update ON public.tasks;
DROP POLICY tasks_delete ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (creator_id = (SELECT auth.uid()) AND public.can_create_in_kanban_column(column_id));
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated USING ((SELECT public.is_supervisor()));

-- status is only a compatibility mirror. IDs define the relationship and the FK
-- guarantees that the selected column belongs to the selected Kanban.
CREATE FUNCTION public.validate_kanban_task()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  target public.kanban_columns%ROWTYPE;
  source public.kanban_columns%ROWTYPE;
  actor_role public.user_role;
  actor_id uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kanban_id IS NULL THEN
      SELECT id INTO NEW.kanban_id FROM public.kanbans ORDER BY (slug = 'principal') DESC, position, id LIMIT 1;
    END IF;
    IF NEW.column_id IS NULL THEN
      SELECT id INTO NEW.column_id FROM public.kanban_columns
      WHERE kanban_id = NEW.kanban_id AND (NEW.status IS NULL OR key = NEW.status)
      ORDER BY position, id LIMIT 1;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.column_id IS NOT DISTINCT FROM OLD.column_id
    AND NEW.kanban_id IS NOT DISTINCT FROM OLD.kanban_id THEN
    SELECT id INTO NEW.column_id FROM public.kanban_columns
    WHERE kanban_id = NEW.kanban_id AND key = NEW.status;
  END IF;

  SELECT * INTO target FROM public.kanban_columns WHERE id = NEW.column_id;
  IF NOT FOUND OR target.kanban_id IS DISTINCT FROM NEW.kanban_id THEN
    RAISE EXCEPTION 'A coluna deve pertencer ao Kanban da tarefa' USING ERRCODE = '23503';
  END IF;
  NEW.status := target.key;

  IF NEW.archived AND (TG_OP = 'INSERT' OR NOT OLD.archived OR NEW.column_id IS DISTINCT FROM OLD.column_id)
    AND target.kind <> 'completed' THEN
    RAISE EXCEPTION 'Somente tarefas em uma coluna de conclusão podem ser arquivadas' USING ERRCODE = '23514';
  END IF;

  IF actor_id IS NOT NULL THEN
    SELECT role INTO actor_role FROM public.users WHERE id = actor_id;
    IF actor_role IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = '42501'; END IF;
    IF TG_OP = 'INSERT' AND NEW.archived AND actor_role NOT IN ('supervisor_geral', 'supervisor_adjunto') THEN
      RAISE EXCEPTION 'Somente supervisores podem criar tarefas arquivadas' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
        RAISE EXCEPTION 'O criador da tarefa não pode ser alterado' USING ERRCODE = '42501';
      END IF;
      IF (NEW.archived IS DISTINCT FROM OLD.archived OR NEW.archived_at IS DISTINCT FROM OLD.archived_at)
        AND actor_role NOT IN ('supervisor_geral', 'supervisor_adjunto') THEN
        RAISE EXCEPTION 'Somente supervisores podem arquivar ou desarquivar' USING ERRCODE = '42501';
      END IF;
      IF NEW.column_id IS DISTINCT FROM OLD.column_id OR NEW.kanban_id IS DISTINCT FROM OLD.kanban_id THEN
        SELECT * INTO source FROM public.kanban_columns WHERE id = OLD.column_id;
        IF actor_role <> 'supervisor_geral' AND (
          (actor_role = 'supervisor_adjunto' AND target.kind = 'blocked') OR
          (actor_role NOT IN ('supervisor_geral', 'supervisor_adjunto') AND (
            source.kanban_id <> target.kanban_id OR
            (source.kind <> 'blocked' AND (target.position, target.id) < (source.position, source.id))
          ))
        ) THEN RAISE EXCEPTION 'Movimento não permitido para este papel' USING ERRCODE = '42501'; END IF;
      END IF;
      IF (to_jsonb(NEW) - ARRAY['column_id','status','updated_at','archived','archived_at'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['column_id','status','updated_at','archived','archived_at'])
        AND actor_role NOT IN ('supervisor_geral', 'supervisor_adjunto')
        AND NOT coalesce(OLD.creator_id = actor_id OR (actor_role IN ('tecnico', 'estagiario') AND OLD.assignee_id = actor_id), false) THEN
        RAISE EXCEPTION 'Sem permissão para editar esta tarefa' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tasks_validate_kanban BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_kanban_task();

CREATE FUNCTION public.prevent_nonempty_kanban_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE task_count bigint;
BEGIN
  SELECT count(*) INTO task_count FROM public.tasks WHERE kanban_id = OLD.id;
  IF task_count > 0 THEN
    RAISE EXCEPTION 'Este Kanban possui % tarefa(s), incluindo arquivadas. A exclusão está bloqueada.', task_count USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER kanbans_prevent_nonempty_delete BEFORE DELETE ON public.kanbans
FOR EACH ROW EXECUTE FUNCTION public.prevent_nonempty_kanban_delete();

CREATE FUNCTION public.protect_kanban_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE task_count bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT count(*) INTO task_count FROM public.tasks WHERE column_id = OLD.id;
    IF task_count > 0 THEN
      RAISE EXCEPTION 'Esta coluna possui % tarefa(s), incluindo arquivadas. A exclusão está bloqueada.', task_count USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.kind <> 'completed' AND OLD.kind = 'completed'
    AND EXISTS (SELECT 1 FROM public.tasks WHERE column_id = OLD.id AND archived) THEN
    RAISE EXCEPTION 'Desarquive as tarefas desta coluna antes de remover sua função de conclusão' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kanban_columns_protect BEFORE UPDATE OR DELETE ON public.kanban_columns
FOR EACH ROW EXECUTE FUNCTION public.protect_kanban_column();

CREATE FUNCTION public.create_kanban(p_name text, p_slug text, p_color text)
RETURNS public.kanbans LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE result public.kanbans;
BEGIN
  IF NOT public.is_supervisor() THEN RAISE EXCEPTION 'Somente supervisores podem criar Kanbans' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.kanbans (name, slug, color, position, created_by)
  VALUES (btrim(p_name), p_slug, p_color, (SELECT coalesce(max(position), -1) + 1 FROM public.kanbans), auth.uid())
  RETURNING * INTO result;
  INSERT INTO public.kanban_columns (kanban_id, key, name, color, position)
  VALUES (result.id, 'aberto', 'Aberto', p_color, 0);
  RETURN result;
END;
$$;

-- Reordering is atomic; stale/incomplete lists are rejected instead of partly saved.
CREATE FUNCTION public.reorder_kanbans(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT public.is_supervisor() THEN RAISE EXCEPTION 'Somente supervisores podem ordenar Kanbans' USING ERRCODE = '42501'; END IF;
  LOCK TABLE public.kanbans IN SHARE ROW EXCLUSIVE MODE;
  IF p_ids IS NULL OR cardinality(p_ids) <> (SELECT count(*) FROM public.kanbans)
    OR cardinality(p_ids) <> (SELECT count(DISTINCT requested.id) FROM unnest(p_ids) AS requested(id))
    OR EXISTS (SELECT 1 FROM unnest(p_ids) AS requested(id) WHERE NOT EXISTS (SELECT 1 FROM public.kanbans k WHERE k.id = requested.id)) THEN
    RAISE EXCEPTION 'A lista de Kanbans mudou. Atualize a página.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.kanbans k SET position = ordering.ordinality - 1
  FROM unnest(p_ids) WITH ORDINALITY AS ordering(id, ordinality) WHERE k.id = ordering.id;
END;
$$;

CREATE FUNCTION public.reorder_kanban_columns(p_kanban_id uuid, p_ids uuid[])
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT public.is_supervisor() THEN RAISE EXCEPTION 'Somente supervisores podem ordenar colunas' USING ERRCODE = '42501'; END IF;
  PERFORM id FROM public.kanbans WHERE id = p_kanban_id FOR UPDATE;
  IF p_ids IS NULL OR cardinality(p_ids) <> (SELECT count(*) FROM public.kanban_columns WHERE kanban_id = p_kanban_id)
    OR cardinality(p_ids) <> (SELECT count(DISTINCT requested.id) FROM unnest(p_ids) AS requested(id))
    OR EXISTS (SELECT 1 FROM unnest(p_ids) AS requested(id) WHERE NOT EXISTS (
      SELECT 1 FROM public.kanban_columns c WHERE c.id = requested.id AND c.kanban_id = p_kanban_id)) THEN
    RAISE EXCEPTION 'A lista de colunas mudou. Atualize a página.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.kanban_columns c SET position = ordering.ordinality - 1
  FROM unnest(p_ids) WITH ORDINALITY AS ordering(id, ordinality) WHERE c.id = ordering.id AND c.kanban_id = p_kanban_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_kanban(text,text,text), public.reorder_kanbans(uuid[]), public.reorder_kanban_columns(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_kanban(text,text,text), public.reorder_kanbans(uuid[]), public.reorder_kanban_columns(uuid,uuid[]) TO authenticated;

-- Read-only compatibility for old clients during deployment. New code never uses boards.
CREATE VIEW public.boards WITH (security_invoker = true) AS
SELECT id, key, name, color, position, created_at FROM public.kanban_columns
WHERE kanban_id = (SELECT id FROM public.kanbans WHERE slug = 'principal');
GRANT SELECT ON public.boards TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.boards FROM authenticated, anon;

-- Keep metadata and active tasks available through Supabase Realtime.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'kanbans') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.kanbans;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'kanban_columns') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_columns;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
  END IF;
END $$;
COMMIT;
