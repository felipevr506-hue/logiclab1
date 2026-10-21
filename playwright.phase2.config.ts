import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import path from "node:path";

loadEnvConfig(process.cwd(), true);
const adminUrl = process.env.PHASE2_ADMIN_URL ?? process.env.DATABASE_URL;
if (!adminUrl)
  throw new Error(
    "A PostgreSQL administrator URL is required for isolated tests.",
  );
const name =
  process.env.PHASE2_DATABASE_NAME ??
  `logiclab_phase2_test_${randomBytes(6).toString("hex")}`;
if (!/^logiclab_phase2_test_[a-f0-9]{12}$/.test(name))
  throw new Error("Invalid test database name.");
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${name}`;
process.env.PHASE2_ADMIN_URL = adminUrl;
process.env.PHASE2_DATABASE_NAME = name;
process.env.PHASE2_DATABASE_URL = testUrl.toString();
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  process.cwd(),
  ".playwright-browsers",
);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "auth-lifecycle.spec.ts",
    "account-isolation.spec.ts",
    "security-isolation.spec.ts",
  ],
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 45_000 },
  reporter: "list",
  outputDir: ".tmp/phase2-test-results",
  globalTeardown: "./tests/phase2-teardown.ts",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    baseURL: "http://127.0.0.1:3208",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/phase2-test-server.cjs",
    url: "http://127.0.0.1:3208/api/status",
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: testUrl.toString(),
      PHASE2_ADMIN_URL: adminUrl,
      PHASE2_DATABASE_NAME: name,
      APP_ENV: "test",
      AUTH_MODE: "required",
      TEST_AUTH_ROLE: "ADMIN",
      AUTH_EMAIL_DELIVERY: process.env.PHASE2_EMAIL_FAILURE
        ? "unavailable"
        : "",
      RESEND_API_KEY: "",
      AUTH_EMAIL_FROM: "",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3208",
      NEXT_PUBLIC_BROWSER_EXECUTOR_ENABLED: "true",
      NEXT_DIST_DIR: ".next-test",
      LOGICLAB_DATA_NAMESPACE: `phase2-${name.slice(-12)}`,
    },
  },
});
