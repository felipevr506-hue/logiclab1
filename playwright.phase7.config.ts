import { defineConfig } from "@playwright/test";
import phase6 from "./playwright.phase6.config";
const server = phase6.webServer;
if (!server || Array.isArray(server)) throw Error("Expected isolated server");
export default defineConfig({
  ...phase6,
  testMatch: ["tutor-chat.spec.ts"],
  outputDir: ".tmp/phase7-test-results",
  webServer: {
    ...server,
    env: {
      ...server.env,
      TUTOR_PROVIDER: process.env.PHASE7_UNCONFIGURED
        ? (process.env.PHASE7_UNCONFIGURED_PROVIDER ?? "openai")
        : "mock",
      OPENROUTER_API_KEY: "",
      TUTOR_MODEL:
        process.env.PHASE7_UNCONFIGURED_PROVIDER === "openrouter"
          ? "openrouter/free"
          : "",
    },
  },
});
