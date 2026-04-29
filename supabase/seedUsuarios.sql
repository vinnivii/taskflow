-- Como aplicar: colar no SQL Editor do Supabase Dashboard e executar
-- Senha de todos os usuários: REDACTED_USE_SEED_USERS_PASSWORD

DO $$
DECLARE
  id_evanilson uuid := 'a1000000-0000-0000-0000-000000000001';
  id_marcus    uuid := 'a1000000-0000-0000-0000-000000000002';
  id_douglas   uuid := 'a1000000-0000-0000-0000-000000000003';
BEGIN

  -- Cria os usuários no sistema de autenticação do Supabase
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    aud, role
  )
  VALUES
    (
      id_evanilson, 'evanilson.softcom@gmail.com',
      crypt('REDACTED_USE_SEED_USERS_PASSWORD', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      'authenticated', 'authenticated'
    ),
    (
      id_marcus, 'vinnivii00@gmail.com',
      crypt('REDACTED_USE_SEED_USERS_PASSWORD', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      'authenticated', 'authenticated'
    ),
    (
      id_douglas, 'douglass.softcom@gmail.com',
      crypt('REDACTED_USE_SEED_USERS_PASSWORD', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      'authenticated', 'authenticated'
    )
  ON CONFLICT (id) DO NOTHING;

  -- Cria os perfis na tabela pública de usuários
  INSERT INTO public.users (id, name, email, avatar, role, department, created_at)
  VALUES
    (id_evanilson, 'Evanilson', 'evanilson.softcom@gmail.com', '', 'supervisor_geral', 'suporte', now()),
    (id_marcus,    'Marcus',    'vinnivii00@gmail.com',         '', 'supervisor_geral', 'suporte', now()),
    (id_douglas,   'Douglas',   'douglass.softcom@gmail.com',   '', 'supervisor_geral', 'suporte', now())
  ON CONFLICT (id) DO NOTHING;

END $$;
