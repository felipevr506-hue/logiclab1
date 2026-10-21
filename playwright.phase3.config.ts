import { defineConfig } from "@playwright/test";
import phase2 from "./playwright.phase2.config";
export default defineConfig({
  ...phase2,
  // Run the existing phase2 config separately: sharing one IP/process with all
  // account fixtures exhausts its intentional email-verification rate limit.
  testMatch: ["server-progress.spec.ts"],
  outputDir: ".tmp/phase3-test-results",
  timeout: 240_000,
});
