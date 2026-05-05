-- Recria is_supervisor com search_path fixo e permissões corretas.
-- Corrige alertas: function_search_path_mutable e anon_security_definer_function_executable.
CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('supervisor_geral', 'supervisor_adjunto')
  );
$$;

-- Remove acesso público e anônimo (a função não deve ser chamável via REST API)
REVOKE EXECUTE ON FUNCTION public.is_supervisor() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_supervisor() FROM anon;

-- Garante acesso somente para autenticados (necessário para as políticas RLS avaliarem a função)
GRANT EXECUTE ON FUNCTION public.is_supervisor() TO authenticated;
