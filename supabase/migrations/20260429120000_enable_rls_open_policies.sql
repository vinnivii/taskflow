-- Habilita RLS em todas as tabelas com políticas abertas.
-- Comportamento idêntico ao RLS desativado, mas as tabelas aparecem
-- como RESTRICTED no dashboard e estão prontas para receber políticas
-- reais quando o login via Supabase Auth for implementado.

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_comments" ON public.comments FOR ALL USING (true) WITH CHECK (true);

-- activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
