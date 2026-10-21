import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { serverDataDirectory } from "@/services/persistence/server-data-directory";

export type AdminAuditEntry = {
  id: string;
  actorId: string;
  action: string;
  target: string;
  before: unknown;
  after: unknown;
  ip: string;
  createdAt: string;
};

const directory = serverDataDirectory("observability");
const file = path.join(directory, "admin-audit.json");
let writeQueue = Promise.resolve();

async function readEntries() {
  try {
    return JSON.parse(await readFile(file, "utf8")) as AdminAuditEntry[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function recordAdminAudit(
  entry: Omit<AdminAuditEntry, "id" | "createdAt">,
) {
  const complete: AdminAuditEntry = {
    ...entry,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const entries = await readEntries();
    entries.push(complete);
    await mkdir(directory, { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(entries.slice(-10_000)), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, file);
  });
  await writeQueue;
  return complete;
}

export async function listAdminAudit(limit = 100) {
  const safeLimit = Math.max(1, Math.min(250, Math.trunc(limit)));
  return (await readEntries()).toReversed().slice(0, safeLimit);
}
