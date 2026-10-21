import { defineConfig } from "@playwright/test";
import phase2 from "./playwright.phase2.config";

export default defineConfig({
  ...phase2,
  testMatch: ["dashboard-navigation.spec.ts"],
  outputDir: ".tmp/phase5-test-results",
  timeout: 240_000,
});
