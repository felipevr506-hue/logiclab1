import { SKILL_CATALOG, type SkillId } from "@/lib/gamification-config";
import type { AppState, Exercise, UserSkillProgress } from "@/lib/types";

type MasteryUpdate = {
  exercise: Exercise;
  passed: boolean;
  attemptNumber: number;
  hintsUsed: number;
  debuggingResolved?: boolean;
  assessment?: boolean;
  createdAt?: string;
};

const conceptSkills: Record<string, SkillId> = {
  algoritmos: "algoritmos",
  variáveis: "variaveis",
  "tipos de dados": "tipos",
  strings: "tipos",
  operadores: "operadores",
  comparações: "condicoes",
  condições: "condicoes",
  sequências: "loops",
  loops: "loops",
  funções: "funcoes",
  "revisão dos fundamentos": "funcoes",
  arrays: "arrays",
  listas: "arrays",
  decomposição: "decomposicao",
};

export function getExerciseSkillId(exercise: Exercise): SkillId {
  return (
    conceptSkills[exercise.concept.toLocaleLowerCase("pt-BR")] ?? "resolucao"
  );
}

export function normalizeDifficulty(exercise: Exercise) {
  if (exercise.difficulty === "Fácil") return "easy" as const;
  if (exercise.difficulty === "Médio") return "medium" as const;
  return "hard" as const;
}

function updateSingleSkill(
  current: UserSkillProgress | undefined,
  skillId: SkillId,
  update: MasteryUpdate,
) {
  const difficulty = normalizeDifficulty(update.exercise);
  const baseWeight = { easy: 0.3, medium: 0.36, hard: 0.44, expert: 0.5 }[
    difficulty
  ];
  const weight = Math.min(0.62, baseWeight + (update.assessment ? 0.1 : 0));
  const previousMastery = current?.masteryScore ?? 0;
  const successQuality = Math.max(
    35,
    100 - Math.max(0, update.attemptNumber - 1) * 7 - update.hintsUsed * 6,
  );
  const target = update.passed
    ? successQuality
    : Math.max(5, previousMastery - 20);
  const masteryScore = Math.round(
    Math.max(
      0,
      Math.min(100, previousMastery + (target - previousMastery) * weight),
    ),
  );
  const createdAt = update.createdAt ?? new Date().toISOString();
  return {
    skillId,
    masteryScore,
    attempts: (current?.attempts ?? 0) + 1,
    correctAttempts: (current?.correctAttempts ?? 0) + Number(update.passed),
    hintsUsed: (current?.hintsUsed ?? 0) + update.hintsUsed,
    lastPracticedAt: createdAt,
    evidence: [
      ...(current?.evidence ?? []),
      {
        id:
          globalThis.crypto?.randomUUID?.() ??
          `skill-${skillId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        exerciseId: update.exercise.id,
        passed: update.passed,
        difficulty,
        masteryAfter: masteryScore,
        createdAt,
      },
    ].slice(-30),
  } satisfies UserSkillProgress;
}

export function updateSkillMastery(state: AppState, update: MasteryUpdate) {
  const primarySkillId = getExerciseSkillId(update.exercise);
  const userSkills = { ...state.userSkills };
  userSkills[primarySkillId] = updateSingleSkill(
    userSkills[primarySkillId],
    primarySkillId,
    update,
  );

  if (update.debuggingResolved) {
    userSkills.debugging = updateSingleSkill(
      userSkills.debugging,
      "debugging",
      { ...update, passed: true, hintsUsed: 0 },
    );
  }

  return { ...state, userSkills };
}

export function getSkillStatus(masteryScore: number) {
  if (masteryScore >= 80) return "mastered" as const;
  if (masteryScore >= 45) return "developing" as const;
  return "review" as const;
}

export function getAdaptiveRecommendation(state: Pick<AppState, "userSkills">) {
  const practiced = SKILL_CATALOG.map((skill) => ({
    ...skill,
    progress: state.userSkills[skill.id],
  })).filter((skill) => skill.progress?.attempts);

  if (!practiced.length)
    return {
      skillId: "algoritmos" as SkillId,
      title: "Algoritmos — Fácil",
      reason: "Comece pela base e avance com evidências reais de aprendizagem.",
      difficulty: "easy" as const,
    };

  const weakest = practiced.toSorted(
    (a, b) => a.progress.masteryScore - b.progress.masteryScore,
  )[0];
  if (weakest.progress.masteryScore < 45)
    return {
      skillId: weakest.id,
      title: `Revisão de ${weakest.title}`,
      reason: `Seu domínio atual é ${weakest.progress.masteryScore}%. Uma revisão guiada é o próximo passo mais seguro.`,
      difficulty: "easy" as const,
    };

  const strongest = practiced.toSorted(
    (a, b) => b.progress.masteryScore - a.progress.masteryScore,
  )[0];
  return {
    skillId: strongest.id,
    title: `${strongest.title} — ${strongest.progress.masteryScore >= 80 ? "Difícil" : "Média"}`,
    reason:
      strongest.progress.masteryScore >= 80
        ? "Você domina os fundamentos; avance apenas um degrau na dificuldade."
        : "Continue consolidando o conceito com exercícios médios.",
    difficulty:
      strongest.progress.masteryScore >= 80
        ? ("hard" as const)
        : ("medium" as const),
  };
}
