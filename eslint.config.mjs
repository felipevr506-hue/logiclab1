import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next-*/**",
    ".tmp/**",
    "playwright-report/**",
    "test-results/**",
    "public/monaco/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
]);
