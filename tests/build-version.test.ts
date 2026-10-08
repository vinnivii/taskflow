import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../scripts/syncVersion.mjs", import.meta.url));
const fixtures: string[] = [];
function fixture(localEnv?: string) {
  const folder = mkdtempSync(join(tmpdir(), "taskflow-version-"));
  fixtures.push(folder);
  writeFileSync(join(folder, "package.json"), JSON.stringify({ name: "version-test", version: "1.0.0" }));
  writeFileSync(join(folder, "package-lock.json"), JSON.stringify({ version: "1.0.0", packages: { "": { version: "1.0.0" } } }));
  if (localEnv !== undefined) writeFileSync(join(folder, ".env"), localEnv);
  return folder;
}
function run(folder: string, environmentVersion?: string) {
  const env = { ...process.env };
  delete env.VITE_APP_VERSION;
  if (environmentVersion !== undefined) env.VITE_APP_VERSION = environmentVersion;
  return execFileSync(process.execPath, [script], { cwd: folder, env, encoding: "utf8", stdio: "pipe" });
}
function versions(folder: string) {
  const manifest = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(folder, "package-lock.json"), "utf8"));
  return [manifest.version, lock.version, lock.packages[""].version];
}
afterEach(() => {
  // Remove only the three files created by this fixture, then its empty directory.
  for (const folder of fixtures.splice(0)) {
    for (const file of ["package.json", "package-lock.json", ".env"]) {
      const path = join(folder, file);
      if (existsSync(path)) unlinkSync(path);
    }
    rmdirSync(folder);
  }
});

describe("version synchronization in local and hosted builds", () => {
  it("builds without a local .env using the manifest version", () => {
    const folder = fixture();
    expect(() => run(folder)).not.toThrow();
    expect(versions(folder)).toEqual(["1.0.0", "1.0.0", "1.0.0"]);
  });
  it("uses the hosting environment version before the local file", () => {
    const folder = fixture("VITE_APP_VERSION=2.0.0\n");
    run(folder, "3.0.0");
    expect(versions(folder)).toEqual(["3.0.0", "3.0.0", "3.0.0"]);
  });
  it("preserves quoted local versions and updates both manifests", () => {
    const folder = fixture('VITE_APP_VERSION="2.1.0-beta.1"\n');
    run(folder);
    expect(versions(folder)).toEqual(["2.1.0-beta.1", "2.1.0-beta.1", "2.1.0-beta.1"]);
  });
  it("falls back to the manifest when .env contains only other settings", () => {
    const folder = fixture("VITE_APP_NAME=TaskFlow\n");
    expect(() => run(folder)).not.toThrow();
    expect(versions(folder)).toEqual(["1.0.0", "1.0.0", "1.0.0"]);
  });
  it("rejects invalid explicit versions without changing either manifest", () => {
    const folder = fixture();
    expect(() => run(folder, "invalid-version")).toThrow();
    expect(versions(folder)).toEqual(["1.0.0", "1.0.0", "1.0.0"]);
  });
});
