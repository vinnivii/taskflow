import { readFileSync, writeFileSync } from "node:fs";

const envPath = ".env";
const packagePath = "package.json";
const lockPath = "package-lock.json";

function readVersion() {
  let configuredVersion = process.env.VITE_APP_VERSION?.trim();
  if (!configuredVersion) {
    try {
      const env = readFileSync(envPath, "utf8");
      configuredVersion = env.match(/^VITE_APP_VERSION=(.+)$/m)?.[1]?.trim();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  const rawVersion = configuredVersion || JSON.parse(readFileSync(packagePath, "utf8")).version;
  const version = typeof rawVersion === "string" ? rawVersion.trim().replace(/^["']|["']$/g, "") : "";

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("Versao invalida. Configure VITE_APP_VERSION ou version no package.json.");
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

const version = readVersion();

updateJsonVersion(packagePath, version);
updateJsonVersion(lockPath, version);

console.log(`Versao sincronizada: ${version}`);
