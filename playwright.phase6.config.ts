import { defineConfig } from "@playwright/test";
import phase2 from "./playwright.phase2.config";
const server = phase2.webServer;
if (!server || Array.isArray(server))
  throw new Error("Expected one isolated test server");

export default defineConfig({
  ...phase2,
  testMatch: ["exercise-workspace.spec.ts"],
  outputDir: ".tmp/phase6-test-results",
  timeout: 240_000,
  webServer: {
    ...server,
    env: {
      ...server.env,
      TUTOR_PROVIDER: "mock",
      OPENAI_API_KEY: "",
      TUTOR_MODEL: "",
    },
  },
});
