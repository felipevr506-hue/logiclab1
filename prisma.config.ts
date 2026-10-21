import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Client generation needs the schema, but no database connection at build time.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
