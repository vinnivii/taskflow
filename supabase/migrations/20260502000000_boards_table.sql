CREATE TABLE IF NOT EXISTS public.boards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL UNIQUE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#8A8A8A',
  position   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.boards (key, name, color, position) VALUES
  ('novo',         'Novo',        '#A855F7', 0),
  ('em_andamento', 'Em Andamento','#3B82F6', 1),
  ('em_revisao',   'Em Revisão',  '#F97316', 2),
  ('concluido',    'Concluído',   '#22C55E', 3),
  ('bloqueado',    'Bloqueado',   '#EF4444', 4)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boards_select" ON public.boards;
DROP POLICY IF EXISTS "boards_insert" ON public.boards;
DROP POLICY IF EXISTS "boards_update" ON public.boards;
DROP POLICY IF EXISTS "boards_delete" ON public.boards;

CREATE POLICY "boards_select" ON public.boards FOR SELECT USING (true);
CREATE POLICY "boards_insert" ON public.boards FOR INSERT WITH CHECK (true);
CREATE POLICY "boards_update" ON public.boards FOR UPDATE USING (true);
CREATE POLICY "boards_delete" ON public.boards FOR DELETE USING (true);
