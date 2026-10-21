import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { serverDataDirectory } from "@/services/persistence/server-data-directory";
import { databasePersistenceMode, getPrisma } from "@/services/persistence/database";

export type StoredProgress = {
  account: string;
  revision: number;
  updatedAt: string;
  state: unknown;
};

const storeDirectory = serverDataDirectory("progress");
let writeQueue = Promise.resolve();

function accountKey(account: string) {
  return createHash("sha256")
    .update(account.trim().toLowerCase())
    .digest("hex");
}

function accountFile(account: string) {
  return path.join(storeDirectory, `${accountKey(account)}.json`);
}

function databaseUserId(storageKey: string) {
  return storageKey.startsWith("user:") ? storageKey.slice(5) : null;
}

export async function readStoredProgress(account: string) {
  const userId = databaseUserId(account);
  if (databasePersistenceMode() === "postgres") {
    if (!userId) return null;
    const stored = await getPrisma().progressBackup.findUnique({
      where: { userId },
    });
    return stored
      ? {
          account,
          revision: stored.revision,
          updatedAt: stored.updatedAt.toISOString(),
          state: stored.payload,
        }
      : null;
  }
  try {
    return JSON.parse(
      await readFile(accountFile(account), "utf8"),
    ) as StoredProgress;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeStoredProgress(
  storageKey: string,
  baseRevision: number,
  state: unknown,
  accountLabel = storageKey,
) {
  const userId = databaseUserId(storageKey);
  if (databasePersistenceMode() === "postgres") {
    if (!userId)
      throw new Error("Chave de progresso persistente inválida.");
    const prisma = getPrisma();
    const payload = state as Prisma.InputJsonValue;
    const current = await prisma.progressBackup.findUnique({ where: { userId } });
    if (current) {
      const updated = await prisma.progressBackup.updateMany({
        where: { userId, revision: baseRevision },
        data: { revision: { increment: 1 }, payload },
      });
      if (!updated.count) {
        const conflict = await prisma.progressBackup.findUniqueOrThrow({
          where: { userId },
        });
        return {
          ok: false as const,
          snapshot: {
            account: accountLabel.trim().toLowerCase(),
            revision: conflict.revision,
            updatedAt: conflict.updatedAt.toISOString(),
            state: conflict.payload,
          },
        };
      }
      const stored = await prisma.progressBackup.findUniqueOrThrow({
        where: { userId },
      });
      return {
        ok: true as const,
        snapshot: {
          account: accountLabel.trim().toLowerCase(),
          revision: stored.revision,
          updatedAt: stored.updatedAt.toISOString(),
          state: stored.payload,
        },
      };
    }
    if (baseRevision !== 0) {
      return {
        ok: false as const,
        snapshot: {
          account: accountLabel.trim().toLowerCase(),
          revision: 0,
          updatedAt: new Date(0).toISOString(),
          state: {},
        },
      };
    }
    try {
      const stored = await prisma.progressBackup.create({
        data: { userId, revision: 1, payload },
      });
      return {
        ok: true as const,
        snapshot: {
          account: accountLabel.trim().toLowerCase(),
          revision: stored.revision,
          updatedAt: stored.updatedAt.toISOString(),
          state: stored.payload,
        },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const conflict = await prisma.progressBackup.findUniqueOrThrow({
          where: { userId },
        });
        return {
          ok: false as const,
          snapshot: {
            account: accountLabel.trim().toLowerCase(),
            revision: conflict.revision,
            updatedAt: conflict.updatedAt.toISOString(),
            state: conflict.payload,
          },
        };
      }
      throw error;
    }
  }
  let result:
    | { ok: true; snapshot: StoredProgress }
    | { ok: false; snapshot: StoredProgress };
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await mkdir(storeDirectory, { recursive: true });
    const current = await readStoredProgress(storageKey);
    if (current && current.revision !== baseRevision) {
      result = { ok: false, snapshot: current };
      return;
    }
    const snapshot: StoredProgress = {
      account: accountLabel.trim().toLowerCase(),
      revision: (current?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      state,
    };
    const destination = accountFile(storageKey);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, destination);
    result = { ok: true, snapshot };
  });
  await writeQueue;
  return result!;
}

export async function deleteStoredProgress(account: string) {
  const userId = databaseUserId(account);
  if (databasePersistenceMode() === "postgres") {
    if (!userId) return;
    await getPrisma().progressBackup.deleteMany({ where: { userId } });
    return;
  }
  try {
    await unlink(accountFile(account));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
