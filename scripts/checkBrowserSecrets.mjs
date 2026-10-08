import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parse } from "dotenv";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
if (!existsSync(dist)) throw new Error("Execute npm run build antes da verificacao do bundle.");
const variables = { ...parse(existsSync(join(root, ".env")) ? readFileSync(join(root, ".env")) : ""), ...process.env };
const secrets = Object.entries(variables).filter(([name, value]) => /SERVICE_ROLE|KANBAN_DELETE_PASSWORD|TASK_STORAGE_CLEANUP_SECRET/.test(name) && typeof value === "string" && value.length > 8).map(([, value]) => value);
for (const file of readdirSync(dist, { recursive: true }).filter((file) => /\.(js|html|css|map)$/.test(String(file)))) {
  const text = readFileSync(join(dist, String(file)), "utf8");
  if (secrets.some((secret) => text.includes(secret)) || text.includes("VITE_SUPABASE_SERVICE_ROLE_KEY") || text.includes("KANBAN_DELETE_PASSWORD")) {
    throw new Error("Falha: credencial ou configuracao administrativa encontrada no bundle. Nenhum valor foi impresso.");
  }
}
console.log("Bundle verificado: credenciais administrativas locais ausentes.");
