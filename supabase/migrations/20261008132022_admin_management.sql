-- Administrative operations. No existing data is deleted by this migration.
BEGIN;
ALTER FUNCTION public.is_supervisor() SET search_path = '';

-- Kanban deletion is reachable only through the password-checking Edge Function.
DROP POLICY kanbans_delete ON public.kanbans;
REVOKE DELETE ON public.kanbans FROM authenticated, anon;
DROP POLICY users_insert_supervisor ON public.users;
DROP POLICY users_delete_supervisor ON public.users;
CREATE POLICY users_delete_general ON public.users FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users actor WHERE actor.id = auth.uid() AND actor.role = 'supervisor_geral'));

CREATE TABLE public.admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_action_limits (
  actor_id uuid PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);
-- Storage cannot participate in a PostgreSQL transaction. A durable outbox is
-- committed with each task deletion; failed jobs remain available for retry.
CREATE TABLE public.task_storage_cleanup (
  task_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now() + interval '1 minute',
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX task_storage_cleanup_schedule_idx ON public.task_storage_cleanup(available_at, created_at);
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_storage_cleanup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit, public.admin_action_limits, public.task_storage_cleanup FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_audit, public.admin_action_limits, public.task_storage_cleanup TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_id_seq TO service_role;
REVOKE ALL ON SEQUENCE public.admin_audit_id_seq FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.audit_deleted_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.task_storage_cleanup(task_id) VALUES (OLD.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.admin_audit(actor_id, action, details)
  VALUES (auth.uid(), 'delete_task', jsonb_build_object('task_id', OLD.id, 'kanban_id', OLD.kanban_id, 'column_id', OLD.column_id));
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_deleted_task() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tasks_audit_delete BEFORE DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.audit_deleted_task();

-- Uploads use <task UUID>/<filename>. Reject orphans and synchronize uploads
-- with task deletion so the outbox cannot miss an in-flight object insert.
DROP POLICY comment_images_insert ON storage.objects;
CREATE POLICY comment_images_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'comment-images' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tasks WHERE id = CASE
      WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (storage.foldername(name))[1]::uuid ELSE NULL END
  )
);
CREATE FUNCTION public.validate_task_image_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE task_uuid uuid; prefix text;
BEGIN
  IF NEW.bucket_id = 'comment-images' THEN
    prefix := (storage.foldername(NEW.name))[1];
    IF prefix IS NULL OR prefix !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'A tarefa do arquivo não existe' USING ERRCODE = '23503';
    END IF;
    task_uuid := prefix::uuid;
    PERFORM id FROM public.tasks WHERE id = task_uuid FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A tarefa do arquivo não existe' USING ERRCODE = '23503'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_task_image_owner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER storage_validate_task_image BEFORE INSERT OR UPDATE OF name,bucket_id ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.validate_task_image_owner();

CREATE FUNCTION public.delete_task_with_cleanup(p_task_id uuid, p_kanban_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE removed uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_supervisor() THEN
    RAISE EXCEPTION 'Somente supervisores podem excluir tarefas' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.tasks WHERE id = p_task_id AND kanban_id = p_kanban_id RETURNING id INTO removed;
  IF removed IS NULL THEN RAISE EXCEPTION 'Tarefa removida ou Kanban incorreto' USING ERRCODE = 'P0002'; END IF;
  RETURN removed;
END;
$$;

CREATE FUNCTION public.delete_column_with_tasks(p_column_id uuid, p_kanban_id uuid, p_mode text, p_destination_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE source public.kanban_columns; destination public.kanban_columns; task_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_supervisor() THEN
    RAISE EXCEPTION 'Somente supervisores podem excluir colunas' USING ERRCODE = '42501';
  END IF;
  -- Rare administrative operations serialize all mutations, including inserts
  -- and updates that began before deletion. Reads remain available.
  LOCK TABLE public.kanbans, public.kanban_columns, public.tasks IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO source FROM public.kanban_columns WHERE id = p_column_id AND kanban_id = p_kanban_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coluna removida ou Kanban incorreto' USING ERRCODE = 'P0002'; END IF;
  SELECT count(*) INTO task_count FROM public.tasks WHERE column_id = source.id;
  IF p_mode = 'transfer' THEN
    SELECT * INTO destination FROM public.kanban_columns WHERE id = p_destination_id AND kanban_id = p_kanban_id AND id <> source.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selecione outra coluna do mesmo Kanban' USING ERRCODE = '22023'; END IF;
    IF destination.kind <> 'completed' AND EXISTS (SELECT 1 FROM public.tasks WHERE column_id = source.id AND archived) THEN
      RAISE EXCEPTION 'Tarefas arquivadas exigem uma coluna de conclusão' USING ERRCODE = '23514';
    END IF;
    -- Run the existing movement trigger with the invoking supervisor identity.
    UPDATE public.tasks SET column_id = destination.id, updated_at = now() WHERE column_id = source.id;
  ELSIF p_mode = 'delete' THEN
    DELETE FROM public.tasks WHERE column_id = source.id;
  ELSE RAISE EXCEPTION 'Operação inválida' USING ERRCODE = '22023'; END IF;
  DELETE FROM public.kanban_columns WHERE id = source.id;
  INSERT INTO public.admin_audit(actor_id, action, details) VALUES (auth.uid(), 'delete_column',
    jsonb_build_object('column_id', source.id, 'kanban_id', source.kanban_id, 'name', source.name, 'mode', p_mode, 'destination_id', p_destination_id, 'task_count', task_count));
  RETURN jsonb_build_object('affected', task_count);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_task_with_cleanup(uuid,uuid), public.delete_column_with_tasks(uuid,uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_task_with_cleanup(uuid,uuid), public.delete_column_with_tasks(uuid,uuid,text,uuid) TO authenticated;

-- Distributed rate limit: every password attempt consumes a slot, including
-- correct passwords. Atomic UPSERT prevents parallel requests bypassing it.
CREATE FUNCTION public.reserve_kanban_delete_attempt(p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE used integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND role IN ('supervisor_geral','supervisor_adjunto')) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.admin_action_limits(actor_id, window_start, attempts) VALUES (p_actor_id, now(), 1)
  ON CONFLICT (actor_id) DO UPDATE SET
    attempts = CASE WHEN admin_action_limits.window_start <= now() - interval '15 minutes' THEN 1 ELSE admin_action_limits.attempts + 1 END,
    window_start = CASE WHEN admin_action_limits.window_start <= now() - interval '15 minutes' THEN now() ELSE admin_action_limits.window_start END
  WHERE admin_action_limits.window_start <= now() - interval '15 minutes' OR admin_action_limits.attempts < 5
  RETURNING attempts INTO used;
  RETURN used IS NOT NULL;
END;
$$;

CREATE FUNCTION public.transfer_delete_kanban(p_actor_id uuid, p_source_id uuid, p_destination_id uuid, p_mapping jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE source public.kanbans; destination public.kanbans; task_count bigint; column_count bigint;
BEGIN
  -- No user JWT is forwarded into the privileged client. Authorization is
  -- checked explicitly; existing integrity/archive triggers still execute.
  IF auth.uid() IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND role IN ('supervisor_geral','supervisor_adjunto')) THEN
    RAISE EXCEPTION 'Backend administrativo obrigatório' USING ERRCODE = '42501';
  END IF;
  LOCK TABLE public.kanbans, public.kanban_columns, public.tasks IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO source FROM public.kanbans WHERE id = p_source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kanban de origem não encontrado' USING ERRCODE = 'P0002'; END IF;
  SELECT count(*) INTO task_count FROM public.tasks WHERE kanban_id = source.id;
  SELECT count(*) INTO column_count FROM public.kanban_columns WHERE kanban_id = source.id;
  IF task_count > 0 THEN
    SELECT * INTO destination FROM public.kanbans WHERE id = p_destination_id AND id <> source.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Selecione outro Kanban existente' USING ERRCODE = '22023'; END IF;
    IF p_mapping IS NULL OR jsonb_typeof(p_mapping) <> 'object' THEN RAISE EXCEPTION 'Mapeamento obrigatório' USING ERRCODE = '22023'; END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_mapping)) <> column_count
      OR EXISTS (SELECT 1 FROM public.kanban_columns c WHERE c.kanban_id = source.id AND NOT EXISTS (
        SELECT 1 FROM public.kanban_columns d WHERE d.id::text = p_mapping ->> c.id::text AND d.kanban_id = destination.id)) THEN
      RAISE EXCEPTION 'Mapeie todas as colunas para o Kanban de destino' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tasks t JOIN public.kanban_columns d ON d.id::text = p_mapping ->> t.column_id::text
      WHERE t.kanban_id = source.id AND t.archived AND d.kind <> 'completed') THEN
      RAISE EXCEPTION 'Tarefas arquivadas exigem uma coluna de conclusão' USING ERRCODE = '23514';
    END IF;
    UPDATE public.tasks SET kanban_id = destination.id, column_id = (p_mapping ->> column_id::text)::uuid, updated_at = now()
    WHERE kanban_id = source.id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.tasks WHERE kanban_id = source.id) THEN RAISE EXCEPTION 'Transferência incompleta'; END IF;
  DELETE FROM public.kanban_columns WHERE kanban_id = source.id;
  DELETE FROM public.kanbans WHERE id = source.id;
  INSERT INTO public.admin_audit(actor_id, action, details) VALUES (p_actor_id, 'delete_kanban',
    jsonb_build_object('source_id', source.id, 'name', source.name, 'destination_id', destination.id, 'mapping', p_mapping, 'transferred', task_count));
  RETURN jsonb_build_object('transferred', task_count, 'destination_id', destination.id);
END;
$$;

CREATE FUNCTION public.claim_task_storage_cleanup()
RETURNS SETOF public.task_storage_cleanup LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.task_storage_cleanup SET lease_until = now() + interval '5 minutes', attempts = attempts + 1
  WHERE task_id IN (SELECT task_id FROM public.task_storage_cleanup WHERE available_at <= now()
    AND (lease_until IS NULL OR lease_until < now()) ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT 20)
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.reserve_kanban_delete_attempt(uuid), public.transfer_delete_kanban(uuid,uuid,uuid,jsonb), public.claim_task_storage_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_kanban_delete_attempt(uuid), public.transfer_delete_kanban(uuid,uuid,uuid,jsonb), public.claim_task_storage_cleanup() TO service_role;

CREATE FUNCTION public.kanban_deletion_summary(p_kanban_id uuid)
RETURNS TABLE(id uuid, name text, kind text, "position" integer, task_count bigint, archived_count bigint)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT c.id, c.name, c.kind, c.position, count(t.id), count(t.id) FILTER (WHERE t.archived)
  FROM public.kanban_columns c LEFT JOIN public.tasks t ON t.column_id = c.id
  WHERE c.kanban_id = p_kanban_id GROUP BY c.id ORDER BY c.position, c.id;
$$;
REVOKE ALL ON FUNCTION public.kanban_deletion_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kanban_deletion_summary(uuid) TO authenticated;
COMMIT;
