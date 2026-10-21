import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { isProductionLike } from "@/services/security/environment";

type PrismaGlobal = typeof globalThis & { logicLabPrisma?: PrismaClient };

export function databasePersistenceMode() {
  if (process.env.DATABASE_URL?.trim()) return "postgres" as const;
  return isProductionLike() ? "unavailable" as const : "local" as const;
}

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL é obrigatória para persistência em staging/produção.",
    );
  }
  const shared = globalThis as PrismaGlobal;
  if (!shared.logicLabPrisma) {
    shared.logicLabPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }
  return shared.logicLabPrisma;
}

export function requirePersistentDatabase() {
  const mode = databasePersistenceMode();
  if (mode === "postgres") return getPrisma();
  if (mode === "unavailable") {
    throw new Error(
      "Persistência segura indisponível: configure DATABASE_URL.",
    );
  }
  return null;
}
