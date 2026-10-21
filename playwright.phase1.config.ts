import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  process.cwd(),
  ".playwright-browsers",
);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["account-isolation.spec.ts", "security-isolation.spec.ts"],
  workers: 1,
  // Cold compilation on this Windows workspace can take tens of seconds.
  timeout: 180_000,
  expect: { timeout: 45_000 },
  reporter: "list",
  outputDir: ".tmp/phase1-test-results",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    baseURL: "http://127.0.0.1:3207",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -p 3207",
    url: "http://127.0.0.1:3207/api/status",
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "",
      APP_ENV: "test",
      AUTH_MODE: process.env.PHASE1_AUTH_MODE ?? "",
      TEST_AUTH_ROLE: "",
      AUTH_EMAIL_DELIVERY: "console",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3207",
      NEXT_PUBLIC_BROWSER_EXECUTOR_ENABLED: "true",
      NEXT_DIST_DIR: ".next-test",
      LOGICLAB_DATA_NAMESPACE: `phase1-${Date.now()}`,
    },
  },
});
