import { defineConfig } from "@playwright/test";
import phase2 from "./playwright.phase2.config";

export default defineConfig({
  ...phase2,
  testMatch: ["landing-entry.spec.ts"],
  outputDir: ".tmp/phase4-test-results",
});
