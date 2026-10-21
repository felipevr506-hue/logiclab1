import { exercises } from "@/lib/content";
import {
  addDaysToDateKey,
  dateKeyToDayNumber,
  getBrasiliaDateKey,
} from "@/lib/daily-workouts";
import type { AppState } from "@/lib/types";
import { reconcileProgressionState } from "@/services/gamification/progression";
import { grantEligibleAchievements } from "@/services/learning/learning-program";

export type ProgressMetrics = {
  xp: number;
  completedCount: number;
  totalExercises: number;
  progressPercent: number;
  streak: number;
  longestStreak: number;
};

function normalizeCompleted(completedExercises: string[]) {
  const validIds = new Set(exercises.map((exercise) => exercise.id));
  return [...new Set(completedExercises)].filter((id) => validIds.has(id));
}

function normalizeActiveDays(activeDays: string[]) {
  return [...new Set(activeDays)]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
}

function calculateStreaks(activeDays: string[], date = new Date()) {
  const normalized = normalizeActiveDays(activeDays);
  const dayNumbers = normalized.map(dateKeyToDayNumber);
  const activeSet = new Set(normalized);
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDay: number | undefined;

  for (const day of dayNumbers) {
    runningStreak =
      previousDay !== undefined && day - previousDay === 86_400_000
        ? runningStreak + 1
        : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previousDay = day;
  }

  const today = getBrasiliaDateKey(date);
  const yesterday = addDaysToDateKey(today, -1);
  let cursor = activeSet.has(today)
    ? today
    : activeSet.has(yesterday)
      ? yesterday
      : "";
  let streak = 0;
  while (cursor && activeSet.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  return { streak, longestStreak };
}

export function getProgressMetrics(
  state: Pick<AppState, "completedExercises" | "activeDays" | "xpTransactions">,
  date = new Date(),
): ProgressMetrics {
  const completedExercises = normalizeCompleted(state.completedExercises);
  const xp = state.xpTransactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );
  const completedCount = completedExercises.length;
  const totalExercises = exercises.length;
  const { streak, longestStreak } = calculateStreaks(state.activeDays, date);

  return {
    xp,
    completedCount,
    totalExercises,
    progressPercent: totalExercises
      ? Math.round((completedCount / totalExercises) * 100)
      : 0,
    streak,
    longestStreak,
  };
}

export function synchronizeProgressState(
  state: AppState,
  date = new Date(),
  serverAuthority = false,
) {
  // Browser callers only reconcile presentation. They never mint rewards.
  if (!serverAuthority) return state;
  const completedExercises = normalizeCompleted(state.completedExercises);
  const activeDays = normalizeActiveDays(state.activeDays);
  const validExerciseIds = new Set(exercises.map((exercise) => exercise.id));
  const existingKeys = new Set<string>();
  const xpTransactions = state.xpTransactions.filter((transaction) => {
    if (
      !transaction.uniqueKey ||
      existingKeys.has(transaction.uniqueKey) ||
      !Number.isInteger(transaction.amount) ||
      transaction.amount <= 0
    )
      return false;
    existingKeys.add(transaction.uniqueKey);
    return (
      !transaction.exerciseId || validExerciseIds.has(transaction.exerciseId)
    );
  });

  const normalized = grantEligibleAchievements(
    reconcileProgressionState({
      ...state,
      completedExercises,
      activeDays,
      xpTransactions,
    }),
    new Date().toISOString(),
  );
  const primaryLanguage = normalized.userLanguages.some(
    (language) => language.languageId === normalized.primaryLanguage,
  )
    ? normalized.primaryLanguage
    : "javascript";
  const metrics = getProgressMetrics(normalized, date);
  return {
    ...normalized,
    primaryLanguage,
    xp: metrics.xp,
    streak: metrics.streak,
    longestStreak: metrics.longestStreak,
  };
}
