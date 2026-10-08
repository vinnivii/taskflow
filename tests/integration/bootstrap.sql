-- Isolated runner only. Match the existing production grants verified read-only.
-- New local Supabase projects do not automatically grant Data API table access.
GRANT SELECT, INSERT ON public.users TO service_role;
GRANT SELECT ON public.users TO authenticated;
-- RLS policies and the Auth foreign key remain active.
