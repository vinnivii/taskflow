alter table public.tasks
  add column if not exists tags text[] not null default '{}',
  add column if not exists comments jsonb not null default '[]'::jsonb,
  add column if not exists attachments integer not null default 0,
  add column if not exists activity_log jsonb not null default '[]'::jsonb;
