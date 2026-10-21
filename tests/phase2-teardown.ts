import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";

export default async function teardown() {
  const name = process.env.PHASE2_DATABASE_NAME ?? "";
  if (!/^logiclab_phase2_test_[a-f0-9]{12}$/.test(name))
    throw new Error("Refusing to clean an unknown database.");
  const marker = path.resolve(".tmp/phase2-owned", name);
  if (!fs.existsSync(marker) || fs.readFileSync(marker, "utf8") !== name)
    return;
  const db = new Client({
    connectionString: process.env.PHASE2_ADMIN_URL,
    connectionTimeoutMillis: 5000,
  });
  await db.connect();
  try {
    await db.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [name],
    );
    await db.query(`DROP DATABASE "${name}"`);
    fs.unlinkSync(marker);
  } finally {
    await db.end();
  }
}
