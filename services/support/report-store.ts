import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { serverDataDirectory } from "@/services/persistence/server-data-directory";

export type SupportTicket = {
  id: string;
  status: "open" | "reviewing" | "answered" | "resolved";
  category: string;
  summary: string;
  page: string;
  exerciseId?: string;
  language?: string;
  browser: string;
  errorType?: string;
  executionId?: string;
  appVersion: string;
  createdAt: string;
};

const directory = serverDataDirectory("support");
const destination = path.join(directory, "tickets.json");
let writeQueue = Promise.resolve();

async function readTickets(): Promise<SupportTicket[]> {
  try {
    return JSON.parse(await readFile(destination, "utf8")) as SupportTicket[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function createSupportTicket(
  input: Omit<SupportTicket, "id" | "status" | "createdAt" | "appVersion">,
) {
  const ticket: SupportTicket = {
    ...input,
    id: `LL-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: "open",
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    createdAt: new Date().toISOString(),
  };
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const tickets = await readTickets();
    tickets.push(ticket);
    await mkdir(directory, { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(tickets), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, destination);
  });
  await writeQueue;
  return ticket;
}
