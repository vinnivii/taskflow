import { createClient } from "npm:@supabase/supabase-js@2.105.1";
import { createAdminHandler, type AdminEndpoint } from "./admin.ts";

export function serve(endpoint: AdminEndpoint) {
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  Deno.serve(createAdminHandler(endpoint, { client, secret: (name) => Deno.env.get(name) }));
}
