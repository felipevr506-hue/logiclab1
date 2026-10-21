// Disposable PostgreSQL database: never run test writes against loglab.
/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test bootstrap. */
const { Client } = require("pg");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

(async () => {
  const name = process.env.PHASE2_DATABASE_NAME;
  if (!/^logiclab_phase2_test_[a-f0-9]{12}$/.test(name || ""))
    throw new Error("Invalid test database name.");
  const admin = new Client({
    connectionString: process.env.PHASE2_ADMIN_URL,
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  fs.mkdirSync(".tmp/phase2-owned", { recursive: true });
  fs.writeFileSync(path.join(".tmp/phase2-owned", name), name);
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(
    fs.readFileSync(
      "prisma/migrations/20260826210000_auth_billing_baseline/migration.sql",
      "utf8",
    ),
  );
  await db.query(
    `INSERT INTO "User" (id,email,"updatedAt") VALUES ('phase2-legacy','Legacy@EXAMPLE.test',now())`,
  );
  await db.query(
    `INSERT INTO "ProgressBackup" (id,"userId",payload,"updatedAt") VALUES ('phase2-legacy-backup','phase2-legacy','{"preserved":true}',now())`,
  );
  await db.query(
    fs.readFileSync(
      "prisma/migrations/20261017180000_username_and_normalized_email/migration.sql",
      "utf8",
    ),
  );
  // Later additive migrations are exercised by the same isolated auth/isolation harness.
  for (const migration of fs
    .readdirSync("prisma/migrations")
    .filter((name) => /^\d/.test(name))
    .sort()) {
    if (migration <= "20261017180000_username_and_normalized_email") continue;
    await db.query(
      fs.readFileSync(
        path.join("prisma/migrations", migration, "migration.sql"),
        "utf8",
      ),
    );
  }
  const preserved = await db.query(
    `SELECT u.username, u.email, p.payload FROM "User" u JOIN "ProgressBackup" p ON p."userId"=u.id WHERE u.id='phase2-legacy'`,
  );
  if (
    preserved.rows[0]?.username !== "legacy_1" ||
    preserved.rows[0]?.email !== "legacy@example.test" ||
    !preserved.rows[0]?.payload.preserved
  )
    throw new Error("Migration did not preserve the legacy fixture.");
  await db.end();
  console.log(
    "Phase 2: disposable PostgreSQL ready; legacy migration fixture preserved.",
  );
  const env = { ...process.env };
  delete env.PHASE2_ADMIN_URL;
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", "3208"],
    { stdio: "inherit", env },
  );
  child.on("exit", (code) => process.exit(code ?? 0));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
