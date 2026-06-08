import { readFileSync, writeFileSync } from "node:fs";

const envPath = ".env";
const packagePath = "package.json";
const lockPath = "package-lock.json";

function readEnvVersion() {
  const env = readFileSync(envPath, "utf8");
  const match = env.match(/^VITE_APP_VERSION=(.+)$/m);
  const version = match?.[1]?.trim().replace(/^["']|["']$/g, "");

  if (!version) {
    throw new Error("VITE_APP_VERSION nao encontrada no .env");
  }

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`VITE_APP_VERSION invalida: ${version}`);
  }

  return version;
}

function updateJsonVersion(path, version) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  data.version = version;

  if (data.packages?.[""]) {
    data.packages[""].version = version;
  }

  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

const version = readEnvVersion();

updateJsonVersion(packagePath, version);
updateJsonVersion(lockPath, version);

console.log(`Versao sincronizada pelo .env: ${version}`);
