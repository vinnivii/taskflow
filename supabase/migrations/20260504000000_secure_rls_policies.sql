-- ============================================================
-- Corrige políticas RLS para exigir autenticação em todas
-- as tabelas e restringir escrita sensível a supervisores.
-- ============================================================

-- Helper: verifica se o usuário logado é supervisor
CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('supervisor_geral', 'supervisor_adjunto')
  );
$$;

-- ── USERS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_users" ON public.users;

-- Qualquer autenticado lê todos os perfis (necessário para exibir assignees)
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Cada usuário atualiza apenas o próprio perfil (avatar, etc.)
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Somente supervisores inserem/deletam usuários
CREATE POLICY "users_insert_supervisor" ON public.users
  FOR INSERT WITH CHECK (public.is_supervisor());

CREATE POLICY "users_delete_supervisor" ON public.users
  FOR DELETE USING (public.is_supervisor());

-- ── TASKS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_tasks" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── COMMENTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_comments" ON public.comments;

CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Autor edita o próprio comentário; supervisor ou autor deleta
CREATE POLICY "comments_update" ON public.comments
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (user_id = auth.uid() OR public.is_supervisor());

-- ── ACTIVITY_LOGS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_activity_logs" ON public.activity_logs;

CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Logs são imutáveis; somente supervisores podem remover se necessário
CREATE POLICY "activity_logs_delete" ON public.activity_logs
  FOR DELETE USING (public.is_supervisor());

-- ── NOTIFICATIONS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_notifications" ON public.notifications;

-- Cada usuário vê apenas as próprias notificações
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- ── BOARDS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "boards_select" ON public.boards;
DROP POLICY IF EXISTS "boards_insert" ON public.boards;
DROP POLICY IF EXISTS "boards_update" ON public.boards;
DROP POLICY IF EXISTS "boards_delete" ON public.boards;

-- Qualquer autenticado lê os quadros
CREATE POLICY "boards_select" ON public.boards
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Somente supervisores modificam quadros
CREATE POLICY "boards_insert" ON public.boards
  FOR INSERT WITH CHECK (public.is_supervisor());

CREATE POLICY "boards_update" ON public.boards
  FOR UPDATE USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

CREATE POLICY "boards_delete" ON public.boards
  FOR DELETE USING (public.is_supervisor());

-- ── STORAGE: comment-images ───────────────────────────────────
-- Remove a policy broad de SELECT que permite listagem pública
DROP POLICY IF EXISTS "comment_images_select" ON storage.objects;

-- Apenas autenticados podem ver objetos individuais (por URL direta)
CREATE POLICY "comment_images_authenticated_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'comment-images' AND auth.uid() IS NOT NULL
  );
