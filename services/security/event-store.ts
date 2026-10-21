import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { serverDataDirectory } from "@/services/persistence/server-data-directory";

export type SecurityEvent = {
  id: string;
  type: string;
  outcome: "success" | "failure" | "blocked";
  actorId?: string;
  targetHash?: string;
  address: string;
  createdAt: string;
};

const directory = serverDataDirectory("observability");
const destination = path.join(directory, "security-events.json");
let queue = Promise.resolve();

export function privacySafeIdentifier(value: string) {
  return createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

async function readEvents(): Promise<SecurityEvent[]> {
  try {
    return JSON.parse(await readFile(destination, "utf8")) as SecurityEvent[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function recordSecurityEvent(
  input: Omit<SecurityEvent, "id" | "createdAt">,
) {
  const event: SecurityEvent = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  queue = queue.catch(() => undefined).then(async () => {
    const events = await readEvents();
    events.push(event);
    await mkdir(directory, { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(events.slice(-20_000)), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, destination);
  });
  await queue;
  return event;
}

export async function listSecurityEvents(limit = 100) {
  return (await readEvents())
    .toReversed()
    .slice(0, Math.max(1, Math.min(250, Math.trunc(limit))));
}
