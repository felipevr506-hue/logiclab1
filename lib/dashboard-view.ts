import {
  getUserDailyWorkout,
  getUserWorkoutSchedule,
  getBrasiliaDateKey,
} from "./daily-workouts";
import { getProgressMetrics } from "./progress";
import type { AppState } from "./types";

/** Read-only presentation over the official state; never grants or persists progress. */
export function getDashboardView(state: AppState, date = new Date()) {
  const schedule = getUserWorkoutSchedule(
    state.user.trainingStartedOn ?? getBrasiliaDateKey(date),
    date,
  );
  const completed = new Set(state.completedExercises);
  const available = schedule.filter((workout) => workout.isUnlocked);
  const hasProgress = state.attemptHistory.length > 0 || completed.size > 0;
  const unfinishedAttempt = state.attemptHistory
    .filter(
      (attempt) =>
        (!attempt.activityMode || attempt.activityMode === "path") &&
        !completed.has(attempt.exerciseId) &&
        available.some((workout) => workout.exerciseId === attempt.exerciseId),
    )
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const next =
    (unfinishedAttempt &&
      available.find(
        (workout) => workout.exerciseId === unfinishedAttempt.exerciseId,
      )) ||
    available.find((workout) => !completed.has(workout.exerciseId));
  const nextRelease = schedule.find(
    (workout) => !workout.isUnlocked && !completed.has(workout.exerciseId),
  );
  return {
    hasProgress,
    metrics: getProgressMetrics(state, date),
    today: getUserDailyWorkout(
      state.user.trainingStartedOn ?? getBrasiliaDateKey(date),
      date,
    ),
    next,
    nextRelease,
    href: next
      ? `/treino/${next.exerciseId}`
      : nextRelease
        ? "/trilha"
        : "/praticar",
    action: hasProgress
      ? "Continuar de onde parei"
      : "Começar minha primeira aula",
    allCompleted: !next && !nextRelease,
  };
}
