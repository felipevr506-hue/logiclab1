import { exercises } from "@/lib/content";
import { addDaysToDateKey, getBrasiliaDateKey } from "@/lib/daily-workouts";
import {
  ACHIEVEMENT_CATALOG,
  PROJECT_CATALOG,
  WEEKLY_MISSION,
  type ProjectId,
} from "@/lib/learning-program";
import type { AppState, RewardGrant } from "@/lib/types";
import { getAdaptiveRecommendation } from "@/services/gamification/mastery";

function createId(prefix: string) {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function getBrasiliaWeek(date = new Date()) {
  const today = getBrasiliaDateKey(date);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const mondayOffset = -((weekday + 6) % 7);
  const start = addDaysToDateKey(today, mondayOffset);
  const end = addDaysToDateKey(start, 6);
  return { key: start, start, end };
}

function belongsToWeek(createdAt: string, start: string, end: string) {
  const key = getBrasiliaDateKey(new Date(createdAt));
  return key >= start && key <= end;
}

export function getPersonalStudyPlan(
  state: Pick<AppState, "primaryLanguage" | "user" | "userSkills">,
) {
  const recommendation = getAdaptiveRecommendation(state);
  const days = Math.max(3, Math.min(7, state.user.studyDaysPerWeek ?? 5));
  const languageNames = {
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
    c: "C",
    cpp: "C++",
  } as const;
  const focus = state.user.studyFocus ?? "Fundamentos e lógica";
  const activities = [
    {
      type: "Treino guiado",
      title: recommendation.title,
      detail: recommendation.reason,
    },
    {
      type: "Prática",
      title: `${focus} na prática`,
      detail: `Exercícios curtos em ${languageNames[state.primaryLanguage]}.`,
    },
    {
      type: "Revisão",
      title: "Revisão espaçada",
      detail: "Reforce o conceito com maior prioridade no histórico.",
    },
    {
      type: "Desafio",
      title: "Resolver sem copiar",
      detail: "Um problema novo com ajuda progressiva disponível.",
    },
    {
      type: "Projeto",
      title: "Aplicação em projeto",
      detail: "Conecte o conceito da semana a uma etapa verificável.",
    },
    {
      type: "Debugging",
      title: "Encontre e corrija",
      detail: "Leia o erro, formule uma hipótese e teste a correção.",
    },
    {
      type: "Exploração",
      title: "Laboratório livre",
      detail: "Altere um exemplo sem pressão por XP ou acerto.",
    },
  ];
  const dayNames = [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
  ];
  return {
    days,
    minutesPerDay: state.user.dailyMinutes,
    focus,
    language: languageNames[state.primaryLanguage],
    sessions: activities.slice(0, days).map((activity, index) => ({
      day: dayNames[index],
      minutes: state.user.dailyMinutes,
      ...activity,
    })),
  };
}

export function getWeeklyMissionProgress(state: AppState, date = new Date()) {
  const week = getBrasiliaWeek(date);
  const weekTransactions = state.xpTransactions.filter((transaction) =>
    belongsToWeek(transaction.createdAt, week.start, week.end),
  );
  const completionTransactions = weekTransactions.filter(
    (transaction) => transaction.reason === "exercise_completion",
  );
  const mediumCompletions = completionTransactions.filter((transaction) => {
    const exercise = exercises.find(
      (candidate) => candidate.id === transaction.exerciseId,
    );
    return (
      exercise?.difficulty === "Médio" || exercise?.difficulty === "Desafio"
    );
  }).length;
  const values = {
    completedExercises: completionTransactions.length,
    mediumCompletions,
    noHintCompletions: weekTransactions.filter(
      (transaction) => transaction.reason === "no_hint",
    ).length,
  };
  const objectives = WEEKLY_MISSION.objectives.map((objective) => {
    const current = Math.min(objective.target, values[objective.metric]);
    return { ...objective, current, complete: current >= objective.target };
  });
  const claimed = state.xpTransactions.some(
    (transaction) =>
      transaction.reason === "weekly_mission" &&
      transaction.uniqueKey === `mission:${WEEKLY_MISSION.id}:${week.key}`,
  );
  return {
    ...WEEKLY_MISSION,
    week,
    objectives,
    completedObjectives: objectives.filter((objective) => objective.complete)
      .length,
    complete: objectives.every((objective) => objective.complete),
    claimed,
  };
}

export function getProjectProgress(state: AppState, projectId: ProjectId) {
  const project = PROJECT_CATALOG.find(
    (candidate) => candidate.id === projectId,
  )!;
  const completedExerciseIds = new Set(
    state.attemptHistory
      .filter(
        (attempt) =>
          attempt.passed &&
          attempt.activityMode === "project" &&
          attempt.projectId === projectId,
      )
      .map((attempt) => attempt.exerciseId),
  );
  const steps = project.steps.map((step) => ({
    ...step,
    complete: completedExerciseIds.has(step.exerciseId),
  }));
  const claimed = state.xpTransactions.some(
    (transaction) =>
      transaction.reason === "project_completion" &&
      transaction.projectId === projectId,
  );
  return {
    ...project,
    steps,
    completedSteps: steps.filter((step) => step.complete).length,
    complete: steps.every((step) => step.complete),
    claimed,
    unlocked: state.level >= project.requiredLevel,
  };
}

export function getWeeklyReport(state: AppState, date = new Date()) {
  const week = getBrasiliaWeek(date);
  const attempts = state.attemptHistory.filter((attempt) =>
    belongsToWeek(attempt.createdAt, week.start, week.end),
  );
  const transactions = state.xpTransactions.filter((transaction) =>
    belongsToWeek(transaction.createdAt, week.start, week.end),
  );
  const activeDays = state.activeDays.filter(
    (day) => day >= week.start && day <= week.end,
  );
  const passed = attempts.filter((attempt) => attempt.passed).length;
  const evidence = Object.values(state.userSkills).flatMap((skill) =>
    skill.evidence
      .filter((item) => belongsToWeek(item.createdAt, week.start, week.end))
      .map((item) => ({ ...item, skillId: skill.skillId })),
  );
  const practicedSkills = Object.values(state.userSkills).filter((skill) =>
    skill.evidence.some((item) =>
      belongsToWeek(item.createdAt, week.start, week.end),
    ),
  );
  const ordered = practicedSkills.toSorted(
    (a, b) => b.masteryScore - a.masteryScore,
  );
  const strongest = ordered[0];
  const weakest = ordered.at(-1);
  return {
    week,
    activeDays: activeDays.length,
    attempts: attempts.length,
    exercisesSolved: new Set(
      attempts
        .filter((attempt) => attempt.passed)
        .map((attempt) => attempt.exerciseId),
    ).size,
    xp: transactions.reduce(
      (total, transaction) => total + transaction.amount,
      0,
    ),
    accuracy: attempts.length
      ? Math.round((passed / attempts.length) * 100)
      : 0,
    hintsUsed: attempts.reduce(
      (total, attempt) => total + attempt.hintsUsed,
      0,
    ),
    estimatedMinutes: attempts.reduce((total, attempt) => {
      const exercise = exercises.find(
        (candidate) => candidate.id === attempt.exerciseId,
      );
      return total + (exercise?.minutes ?? 0);
    }, 0),
    skillsImproved: new Set(evidence.map((item) => item.skillId)).size,
    strongestSkillId: strongest?.skillId,
    weakestSkillId: weakest?.skillId,
    primaryLanguage: state.primaryLanguage,
    streak: state.streak,
  };
}

export function grantEligibleAchievements(state: AppState, createdAt: string) {
  const existing = new Set(state.rewardGrants.map((grant) => grant.rewardId));
  const conditions: Record<string, boolean> = {
    "achievement-primeira-solucao": state.attemptHistory.some(
      (attempt) => attempt.passed,
    ),
    "achievement-sem-ajuda": state.attemptHistory.some(
      (attempt) => attempt.passed && attempt.hintsUsed === 0,
    ),
    "achievement-debugger-iniciante":
      (state.userSkills.debugging?.masteryScore ?? 0) >= 45,
    "achievement-habilidade-dominada": Object.values(state.userSkills).some(
      (skill) => skill.masteryScore >= 80,
    ),
    "achievement-nova-linguagem": state.userLanguages.length > 1,
    "achievement-primeiro-projeto": state.xpTransactions.some(
      (transaction) => transaction.reason === "project_completion",
    ),
  };
  const grants: RewardGrant[] = ACHIEVEMENT_CATALOG.filter(
    (achievement) =>
      conditions[achievement.id] && !existing.has(achievement.id),
  ).map((achievement) => ({
    id: createId("achievement"),
    rewardId: achievement.id,
    level: state.level,
    type: "badge",
    title: achievement.title,
    grantedAt: createdAt,
  }));
  return grants.length
    ? { ...state, rewardGrants: [...state.rewardGrants, ...grants] }
    : state;
}
