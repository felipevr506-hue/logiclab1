import type { AppState, AttemptRecord, Exercise } from "@/lib/types";
import { getBrasiliaDateKey, getUserDailyWorkout } from "@/lib/daily-workouts";
import { XP_REWARDS } from "@/lib/gamification-config";
import { synchronizeProgressState } from "@/lib/progress";
import {
  awardXP,
  type AwardXPRequest,
} from "@/services/gamification/progression";
import {
  normalizeDifficulty,
  updateSkillMastery,
} from "@/services/gamification/mastery";
import {
  getBrasiliaWeek,
  getProjectProgress,
  getWeeklyMissionProgress,
} from "@/services/learning/learning-program";
import {
  PROJECT_CATALOG,
  WEEKLY_MISSION,
  type ProjectId,
} from "@/lib/learning-program";

/** Called with database-owned state and server evaluation only, never browser backup fields. */
export function transitionAttempt(
  current: AppState,
  exercise: Exercise,
  record: AttemptRecord,
  evaluated: boolean,
  now: Date,
) {
  const mode = record.activityMode ?? "path";
  const alreadyComplete = current.completedExercises.includes(exercise.id);
  const today = getBrasiliaDateKey(now);
  let next: AppState = {
    ...current,
    lastXpAward: undefined,
    attempts: { ...current.attempts, [exercise.id]: record.attemptNumber },
    attemptHistory: [...current.attemptHistory, record],
    completedExercises:
      record.passed && mode === "path" && !alreadyComplete
        ? [...current.completedExercises, exercise.id]
        : current.completedExercises,
    activeDays:
      evaluated && !current.activeDays.includes(today)
        ? [...current.activeDays, today]
        : current.activeDays,
  };
  // Replaying a correct answer with a new key cannot manufacture mastery evidence.
  if (
    evaluated &&
    !current.attemptHistory.some(
      (a) => a.exerciseId === exercise.id && a.passed,
    )
  ) {
    next = updateSkillMastery(next, {
      exercise,
      passed: record.passed,
      attemptNumber: record.attemptNumber,
      hintsUsed: record.hintsUsed,
      debuggingResolved: record.passed && exercise.exerciseType === "debugging",
      createdAt: record.createdAt,
    });
  }
  const rewards: AwardXPRequest[] = [];
  if (record.passed && !alreadyComplete && mode === "path") {
    rewards.push({
      amount: XP_REWARDS[normalizeDifficulty(exercise)],
      reason: "exercise_completion",
      uniqueKey: `exercise:${exercise.id}:completion`,
      exerciseId: exercise.id,
      description: `Primeira conclusão: ${exercise.title}`,
      createdAt: record.createdAt,
    });
    const workout = getUserDailyWorkout(current.user.trainingStartedOn, now);
    if (workout.exerciseId === exercise.id) {
      rewards.push(
        {
          amount: XP_REWARDS.dailyChallengeBonus,
          reason: "daily_challenge",
          uniqueKey: `daily:${today}:${exercise.id}:challenge`,
          exerciseId: exercise.id,
          challengeId: today,
          description: `Desafio diário de ${today}`,
          createdAt: record.createdAt,
        },
        {
          amount: XP_REWARDS.workoutCompletionBonus,
          reason: "workout_completion",
          uniqueKey: `daily:${today}:${workout.id}:workout`,
          exerciseId: exercise.id,
          workoutId: workout.id,
          description: `Treino diário completo: ${workout.title}`,
          createdAt: record.createdAt,
        },
      );
    }
    if (record.hintsUsed === 0)
      rewards.push({
        amount: XP_REWARDS.noHintBonus,
        reason: "no_hint",
        uniqueKey: `exercise:${exercise.id}:no-hint`,
        exerciseId: exercise.id,
        description: `Conclusão sem dica oficial: ${exercise.title}`,
        createdAt: record.createdAt,
      });
  } else if (record.passed && mode === "practice") {
    rewards.push({
      amount: XP_REWARDS.review,
      reason: "review",
      uniqueKey: `practice:${getBrasiliaWeek(now).key}:${exercise.id}:review`,
      exerciseId: exercise.id,
      description: `Prática semanal: ${exercise.title}`,
      createdAt: record.createdAt,
    });
  }
  next = awardXP(next, rewards);
  return synchronizeProgressState(next, now, true);
}

export function transitionClaim(current: AppState, projectId?: string) {
  if (projectId) {
    if (!PROJECT_CATALOG.some((p) => p.id === projectId))
      throw new Error("Invalid project");
    const project = getProjectProgress(current, projectId as ProjectId);
    if (!project.unlocked || !project.complete || project.claimed)
      return current;
    return synchronizeProgressState(
      awardXP(current, {
        amount: project.xpReward,
        reason: "project_completion",
        uniqueKey: `project:${projectId}:completion`,
        projectId,
        description: `Projeto concluído: ${project.title}`,
      }),
      new Date(),
      true,
    );
  }
  const mission = getWeeklyMissionProgress(current);
  if (!mission.complete || mission.claimed) return current;
  return synchronizeProgressState(
    awardXP(current, {
      amount: WEEKLY_MISSION.xpReward,
      reason: "weekly_mission",
      uniqueKey: `mission:${WEEKLY_MISSION.id}:${mission.week.key}`,
      missionId: `${WEEKLY_MISSION.id}:${mission.week.key}`,
      description: `Missão semanal: ${WEEKLY_MISSION.title}`,
    }),
    new Date(),
    true,
  );
}
