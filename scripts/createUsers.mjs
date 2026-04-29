import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Faltando VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    name: "Evanilson",
    email: "evanilson.softcom@gmail.com",
    password: "REDACTED_USE_SEED_USERS_PASSWORD",
    role: "supervisor_geral",
    department: "suporte",
  },
  {
    name: "Marcus",
    email: "vinnivii00@gmail.com",
    password: "REDACTED_USE_SEED_USERS_PASSWORD",
    role: "supervisor_geral",
    department: "suporte",
  },
  {
    name: "Douglas",
    email: "douglass.softcom@gmail.com",
    password: "REDACTED_USE_SEED_USERS_PASSWORD",
    role: "supervisor_geral",
    department: "suporte",
  },
];

// Busca todos os usuários existentes no Auth
const { data: authList, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Erro ao listar usuários:", listError.message);
  process.exit(1);
}

console.log(`Usuários encontrados no Auth: ${authList.users.length}`);

for (const u of USERS) {
  const existing = authList.users.find((au) => au.email === u.email);

  if (existing) {
    // Usuário já existe — atualiza a senha pelo ID real
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: u.password,
      email_confirm: true,
    });

    if (updateError) {
      console.error(`✗ Erro ao atualizar ${u.email}:`, updateError.message);
      continue;
    }

    // Upsert do perfil usando o ID real do Auth
    const { error: profileError } = await supabase.from("users").upsert({
      id: existing.id,
      name: u.name,
      email: u.email,
      avatar: "",
      role: u.role,
      department: u.department,
    });

    if (profileError) console.error(`✗ Profile error para ${u.email}:`, profileError.message);
    else console.log(`✓ ${u.name} (${u.email}) — senha atualizada (id: ${existing.id})`);

  } else {
    // Usuário não existe — cria novo
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { name: u.name },
    });

    if (createError) {
      console.error(`✗ Erro ao criar ${u.email}:`, createError.message);
      continue;
    }

    const { error: profileError } = await supabase.from("users").upsert({
      id: authData.user.id,
      name: u.name,
      email: u.email,
      avatar: "",
      role: u.role,
      department: u.department,
    });

    if (profileError) console.error(`✗ Profile error para ${u.email}:`, profileError.message);
    else console.log(`✓ ${u.name} (${u.email}) — criado (id: ${authData.user.id})`);
  }
}
