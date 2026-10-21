import "server-only";

import { getBrasiliaDateKey } from "@/lib/daily-workouts";
import type { AppState, ProgrammingLanguageId } from "@/lib/types";
import { readFeatureFlags } from "@/services/admin/feature-store";

type ProgressIdentity = {
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  plan: "FREE" | "PRO";
};

const MAX_DEPTH = 14;
const MAX_NODES = 60_000;
const MAX_STRING_CHARS = 100_000;

export class InvalidProgressError extends Error {}

function validateJsonShape(value: unknown) {
  let nodes = 0;
  const visit = (current: unknown, depth: number) => {
    nodes += 1;
    if (nodes > MAX_NODES)
      throw new InvalidProgressError("O backup possui itens demais.");
    if (depth > MAX_DEPTH)
      throw new InvalidProgressError("O backup possui aninhamento excessivo.");
    if (typeof current === "string" && current.length > MAX_STRING_CHARS)
      throw new InvalidProgressError("O backup possui um texto muito grande.");
    if (Array.isArray(current)) {
      if (current.length > 10_000)
        throw new InvalidProgressError("O backup possui uma lista muito grande.");
      current.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (current && typeof current === "object") {
      const entries = Object.entries(current as Record<string, unknown>);
      if (entries.length > 5_000)
        throw new InvalidProgressError("O backup possui campos demais.");
      for (const [key, item] of entries) {
        if (key === "__proto__" || key === "prototype" || key === "constructor")
          throw new InvalidProgressError("O backup contÃ©m um campo proibido.");
        visit(item, depth + 1);
      }
    }
  };
  visit(value, 0);
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<AppState>;
  return Boolean(
    state.user &&
      typeof state.user === "object" &&
      state.drafts &&
      typeof state.drafts === "object" &&
      Array.isArray(state.codeVersions) &&
      Array.isArray(state.savedCodeSnippets) &&
      Array.isArray(state.savedTutorExplanations) &&
      state.notificationPreferences &&
      typeof state.notificationPreferences === "object",
  );
}

function authoritativeLanguages(plan: "FREE" | "PRO", createdAt: string) {
  const languages: ProgrammingLanguageId[] =
    plan === "PRO"
      ? ["javascript", "python", "java", "c", "cpp"]
      : ["javascript"];
  return languages.map((languageId) => ({
    languageId,
    unlockedAt: createdAt,
    unlockedBy:
      languageId === "javascript" ? ("initial" as const) : ("plan" as const),
    progressPercent: 0,
  }));
}

/**
 * The generic sync endpoint stores user-authored material and preferences, but
 * never accepts security, billing, unlock, XP, mastery, or completion authority
 * from the browser. They remain neutral in ProgressBackup. Official progress is
 * read separately from UserProgress/Attempt/XPTransaction, never from this backup.
 */
export async function sanitizeProgressBackup(
  value: unknown,
  identity: ProgressIdentity,
  existingTrainingStartedOn?: string,
): Promise<AppState> {
  validateJsonShape(value);
  if (!isAppState(value))
    throw new InvalidProgressError("O formato do backup nÃ£o Ã© reconhecido.");

  const now = new Date().toISOString();
  const userRole = identity.role === "ADMIN" ? "admin" : "student";
  const userPlan = identity.plan === "PRO" ? "pro" : "free";
  const flags = await readFeatureFlags();
  const userLanguages = authoritativeLanguages(identity.plan, now);
  const unlocked = new Set(userLanguages.map((item) => item.languageId));
  const requestedLanguage = value.primaryLanguage;

  return {
    ...value,
    hydrated: false,
    user: {
      ...value.user,
      name: identity.name,
      email: identity.email,
      role: userRole,
      plan: userPlan,
      trainingStartedOn:
        existingTrainingStartedOn ?? getBrasiliaDateKey(new Date()),
    },
    xp: 0,
    level: 1,
    streak: 0,
    longestStreak: 0,
    activeDays: [],
    completedExercises: [],
    attempts: {},
    attemptHistory: [],
    hintsUsed: {},
    xpTransactions: [],
    rewardGrants: [],
    userSkills: {},
    userLanguages,
    primaryLanguage: unlocked.has(requestedLanguage)
      ? requestedLanguage
      : "javascript",
    helpTokens: 0,
    featureFlags: flags,
    lastXpAward: undefined,
  };
}
