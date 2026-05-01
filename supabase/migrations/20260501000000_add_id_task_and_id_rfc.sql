-- id_task: auto-incremented, always generated (read-only)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS id_task bigint GENERATED ALWAYS AS IDENTITY;

-- id_rfc: nullable, user-editable numeric reference
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS id_rfc bigint;
