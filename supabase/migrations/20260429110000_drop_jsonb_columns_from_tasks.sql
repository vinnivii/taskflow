ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS comments,
  DROP COLUMN IF EXISTS activity_log;
