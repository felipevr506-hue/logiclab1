import type { AppState } from "./types";

export const TRUSTED_PROGRESS_KEYS = [
  "xp",
  "level",
  "streak",
  "longestStreak",
  "activeDays",
  "completedExercises",
  "attempts",
  "attemptHistory",
  "hintsUsed",
  "xpTransactions",
  "rewardGrants",
  "userSkills",
  "userLanguages",
  "helpTokens",
  "lastXpAward",
] as const;
export type TrustedFields = Pick<
  AppState,
  (typeof TRUSTED_PROGRESS_KEYS)[number]
>;
export type OfficialProgress = {
  ownerId: string;
  revision: number;
  trainingStartedOn: string;
  progress: TrustedFields;
};

export function emptyTrustedProgress(): TrustedFields {
  return {
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
    helpTokens: 0,
    userLanguages: [
      {
        languageId: "javascript",
        unlockedAt: new Date(0).toISOString(),
        unlockedBy: "initial",
        progressPercent: 0,
      },
    ],
    lastXpAward: undefined,
  };
}

export function trustedFields(state: AppState): TrustedFields {
  return Object.fromEntries(
    TRUSTED_PROGRESS_KEYS.map((key) => [key, state[key]]),
  ) as TrustedFields;
}

/** Local drafts and presentation survive, while trusted fields come only from a verified response. */
export function applyOfficialProgress(
  state: AppState,
  official: OfficialProgress | null,
): AppState {
  if (official && state.user.accountId !== official.ownerId)
    throw new Error("Progress owner mismatch.");
  return {
    ...state,
    ...(official?.progress ?? emptyTrustedProgress()),
    user: {
      ...state.user,
      ...(official ? { trainingStartedOn: official.trainingStartedOn } : {}),
    },
  };
}
