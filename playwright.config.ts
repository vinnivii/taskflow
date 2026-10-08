import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1,
  timeout: 45000, expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:4174", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174", reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_PUBLISHABLE_KEY: "e2e-publishable-placeholder" },
  },
});
