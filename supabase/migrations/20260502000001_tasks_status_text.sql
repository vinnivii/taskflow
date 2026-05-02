-- Migrate tasks.status from enum to text
ALTER TABLE public.tasks
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'novo';
