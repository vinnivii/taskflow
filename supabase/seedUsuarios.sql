-- ATENÇÃO: este arquivo NÃO cria senhas.
-- Para criar os usuários com autenticação, use:
--   npm run seed:users
--
-- Este SQL serve apenas como fallback para inserir perfis
-- em public.users caso os registros auth já existam.

INSERT INTO public.users (id, name, email, avatar, role, department, created_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Evanilson', 'evanilson.softcom@gmail.com', '', 'supervisor_geral', 'suporte', now()),
  ('a1000000-0000-0000-0000-000000000002', 'Marcus',    'vinnivii00@gmail.com',         '', 'supervisor_geral', 'suporte', now()),
  ('a1000000-0000-0000-0000-000000000003', 'Douglas',   'douglass.softcom@gmail.com',   '', 'supervisor_geral', 'suporte', now())
ON CONFLICT (id) DO NOTHING;
