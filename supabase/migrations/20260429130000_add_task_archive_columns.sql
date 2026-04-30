-- Add archive support to tasks.
-- Archived tasks should be hidden from the Kanban board but remain visible in the tasks list.

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS tasks_archived_idx ON public.tasks (archived);

