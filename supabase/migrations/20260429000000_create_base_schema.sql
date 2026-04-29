-- Enums
DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('urgent','high','medium','low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('novo','em_andamento','em_revisao','concluido','bloqueado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'supervisor_geral','supervisor_adjunto','tecnico','estagiario','comercial','financeiro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.department AS ENUM ('comercial','financeiro','suporte');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- users (espelha auth.users com dados extras)
CREATE TABLE IF NOT EXISTS public.users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text NOT NULL,
  avatar     text NOT NULL DEFAULT '',
  role       public.user_role NOT NULL,
  department public.department NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id        text NOT NULL DEFAULT '',
  title             text NOT NULL,
  description       text NOT NULL DEFAULT '',
  priority          public.task_priority NOT NULL DEFAULT 'medium',
  status            public.task_status NOT NULL DEFAULT 'novo',
  department        public.department NOT NULL,
  assignee_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  creator_id        uuid NOT NULL,
  due_date          timestamptz,
  tags              text[] NOT NULL DEFAULT '{}',
  attachments_count int4 NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
