-- ============================================================
-- Corrige performance das políticas RLS: envolve auth.uid()
-- em (select auth.uid()) para evitar re-avaliação por linha.
-- Adiciona indexes em foreign keys sem cobertura.
-- ============================================================

-- ── USERS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select"            ON public.users;
DROP POLICY IF EXISTS "users_update_self"       ON public.users;
DROP POLICY IF EXISTS "users_insert_supervisor" ON public.users;
DROP POLICY IF EXISTS "users_delete_supervisor" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));

CREATE POLICY "users_insert_supervisor" ON public.users
  FOR INSERT WITH CHECK (public.is_supervisor());

CREATE POLICY "users_delete_supervisor" ON public.users
  FOR DELETE USING (public.is_supervisor());

-- ── TASKS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- ── COMMENTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "comments_select" ON public.comments;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
DROP POLICY IF EXISTS "comments_update" ON public.comments;
DROP POLICY IF EXISTS "comments_delete" ON public.comments;

CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "comments_update" ON public.comments
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (user_id = (select auth.uid()) OR public.is_supervisor());

-- ── ACTIVITY_LOGS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_delete" ON public.activity_logs;

CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "activity_logs_delete" ON public.activity_logs
  FOR DELETE USING (public.is_supervisor());

-- ── NOTIFICATIONS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (user_id = (select auth.uid()));

-- ── BOARDS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "boards_select" ON public.boards;
DROP POLICY IF EXISTS "boards_insert" ON public.boards;
DROP POLICY IF EXISTS "boards_update" ON public.boards;
DROP POLICY IF EXISTS "boards_delete" ON public.boards;

CREATE POLICY "boards_select" ON public.boards
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "boards_insert" ON public.boards
  FOR INSERT WITH CHECK (public.is_supervisor());

CREATE POLICY "boards_update" ON public.boards
  FOR UPDATE USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

CREATE POLICY "boards_delete" ON public.boards
  FOR DELETE USING (public.is_supervisor());

-- ── INDEXES em foreign keys sem cobertura ────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id   ON public.activity_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_id        ON public.comments (task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id   ON public.notifications (task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id       ON public.tasks (assignee_id);

-- ── INDEX não utilizado ───────────────────────────────────────
-- tasks_archived_idx nunca foi usado; removido para reduzir overhead de escrita.
DROP INDEX IF EXISTS public.tasks_archived_idx;
