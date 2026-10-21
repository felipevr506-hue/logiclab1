import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { serverDataDirectory } from "@/services/persistence/server-data-directory";

type TutorUsageRecord = {
  id: string;
  exerciseId: string;
  requestType: string;
  model: string;
  promptVersion: string;
  durationMs: number;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  createdAt: string;
};

type TutorFeedbackRecord = {
  id: string;
  messageId: string;
  exerciseId: string;
  helpful: boolean;
  comment?: string;
  createdAt: string;
};

type UsageDatabase = {
  usage: TutorUsageRecord[];
  feedback: TutorFeedbackRecord[];
};

const directory = serverDataDirectory("observability");
const destination = path.join(directory, "tutor-usage.json");
let queue = Promise.resolve();

async function readDatabase(): Promise<UsageDatabase> {
  try {
    return JSON.parse(await readFile(destination, "utf8")) as UsageDatabase;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { usage: [], feedback: [] };
    throw error;
  }
}

async function mutate(mutator: (database: UsageDatabase) => void) {
  queue = queue.catch(() => undefined).then(async () => {
    const database = await readDatabase();
    mutator(database);
    database.usage = database.usage.slice(-20_000);
    database.feedback = database.feedback.slice(-20_000);
    await mkdir(directory, { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(database), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, destination);
  });
  await queue;
}

export async function recordTutorUsage(
  input: Omit<TutorUsageRecord, "id" | "createdAt">,
) {
  const record = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await mutate((database) => database.usage.push(record));
  return record;
}

export async function recordTutorFeedback(
  input: Omit<TutorFeedbackRecord, "id" | "createdAt">,
) {
  const record = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await mutate((database) => database.feedback.push(record));
  return record;
}

export async function getTutorUsageSummary() {
  const database = await readDatabase();
  const successful = database.usage.filter((item) => item.success);
  const positive = database.feedback.filter((item) => item.helpful).length;
  const negative = database.feedback.length - positive;
  return {
    requests: database.usage.length,
    conversations: new Set(database.usage.map((item) => item.exerciseId)).size,
    successRate: database.usage.length
      ? Math.round((successful.length / database.usage.length) * 100)
      : 0,
    averageDurationMs: database.usage.length
      ? Math.round(
          database.usage.reduce((sum, item) => sum + item.durationMs, 0) /
            database.usage.length,
        )
      : 0,
    inputTokens: database.usage.reduce(
      (sum, item) => sum + item.inputTokens,
      0,
    ),
    outputTokens: database.usage.reduce(
      (sum, item) => sum + item.outputTokens,
      0,
    ),
    estimatedCostMicros: database.usage.reduce(
      (sum, item) => sum + item.estimatedCostMicros,
      0,
    ),
    positive,
    negative,
    byType: Object.fromEntries(
      [...new Set(database.usage.map((item) => item.requestType))].map(
        (type) => [
          type,
          database.usage.filter((item) => item.requestType === type).length,
        ],
      ),
    ),
  };
}
