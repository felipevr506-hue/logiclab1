import { expect, test } from "@playwright/test";
import { exercises } from "@/lib/content";
import {
  XP_REWARDS,
  getLevelForXp,
} from "@/lib/gamification-config";
import type { AppState, UserSkillProgress } from "@/lib/types";
import {
  awardXP,
  getLanguageRequirementProgress,
  reconcileProgressionState,
} from "@/services/gamification/progression";
import {
  getAdaptiveRecommendation,
  updateSkillMastery,
} from "@/services/gamification/mastery";
import {
  getProjectProgress,
  getWeeklyMissionProgress,
  getWeeklyReport,
  grantEligibleAchievements,
} from "@/services/learning/learning-program";
import { mergeProgressStates } from "@/services/sync/progress-sync";

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    hydrated: true,
    user: {
      name: "Teste",
      email: "teste@logiclab.dev",
      avatar: "",
      goal: "Aprender programação",
      dailyMinutes: 30,
      experience: "Iniciante",
      onboarded: true,
      plan: "free",
    },
    xp: 0,
    streak: 0,
    longestStreak: 0,
    completedExercises: [],
    attempts: {},
    attemptHistory: [],
    hintsUsed: {},
    tutorMessages: {},
    drafts: {},
    favorites: [],
    notes: {},
    activeDays: [],
    theme: "dark",
    interfaceSize: "standard",
    editorFontSize: 16,
    level: 1,
    xpTransactions: [],
    rewardGrants: [],
    userLanguages: [
      {
        languageId: "javascript",
        unlockedAt: "2026-08-15T00:00:00.000Z",
        unlockedBy: "initial",
        progressPercent: 0,
      },
    ],
    primaryLanguage: "javascript",
    userSkills: {},
    helpTokens: 0,
    codeVersions: [],
    savedTutorExplanations: [],
    savedCodeSnippets: [],
    favoriteProjects: [],
    favoriteConcepts: [],
    exerciseFeedback: [],
    reducedMotion: false,
    notificationPreferences: {
      dailyTraining: true,
      reviews: true,
      achievements: true,
      weeklyGoal: true,
      importantUpdates: true,
    },
    featureFlags: {
      AI_TUTOR: true,
      PLAYGROUND: true,
      DAILY_CHALLENGE: true,
      WEEKLY_MISSIONS: true,
      PYTHON_TRACK: true,
      JAVA_TRACK: true,
      C_TRACK: true,
      CPP_TRACK: true,
      PORTFOLIO: true,
      INTERVIEW_MODE: false,
    },
    editorOnboarded: false,
    tutorOnboarded: false,
    progressionOnboarded: false,
    ...overrides,
  };
}

function skill(skillId: string, masteryScore: number): UserSkillProgress {
  return {
    skillId,
    masteryScore,
    attempts: 5,
    correctAttempts: 4,
    hintsUsed: 1,
    lastPracticedAt: "2026-08-15T12:00:00.000Z",
    evidence: [],
  };
}

test.describe("gamificação transacional", () => {
  test("sincronização preserva as duas versões de um rascunho em conflito", () => {
    const local = baseState({
      drafts: { "playground:python": "print('local')" },
    });
    const remote = baseState({
      drafts: { "playground:python": "print('remoto')" },
    });
    const merged = mergeProgressStates(local, remote);

    expect(merged.drafts["playground:python"]).toBe("print('local')");
    expect(
      merged.codeVersions.filter(
        (version) =>
          version.sourceId === "playground:python" &&
          version.reason === "conflict",
      ),
    ).toHaveLength(2);
    expect(
      merged.codeVersions.every((version) => version.language === "python"),
    ).toBeTruthy();
  });
  test("valores de XP são centralizados e a curva de níveis não é linear", () => {
    expect(XP_REWARDS).toMatchObject({
      easy: 10,
      medium: 25,
      hard: 50,
      expert: 100,
      review: 15,
      dailyChallengeBonus: 30,
      workoutCompletionBonus: 40,
      noHintBonus: 10,
    });
    expect([0, 99, 100, 249, 250, 449, 450, 700].map(getLevelForXp)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 5,
    ]);
  });

  test("awardXP cria transação e bloqueia farm pela mesma chave", () => {
    const request = {
      amount: XP_REWARDS.easy,
      reason: "exercise_completion" as const,
      uniqueKey: "exercise:variaveis:completion",
      exerciseId: "variaveis",
      description: "Primeira conclusão",
      createdAt: "2026-08-15T12:00:00.000Z",
    };
    const first = awardXP(baseState(), request);
    const repeated = awardXP(first, request);

    expect(first.xp).toBe(10);
    expect(first.xpTransactions).toHaveLength(1);
    expect(first.lastXpAward?.duplicate).toBe(false);
    expect(repeated.xp).toBe(10);
    expect(repeated.xpTransactions).toHaveLength(1);
    expect(repeated.lastXpAward?.duplicate).toBe(true);
    expect(repeated.lastXpAward?.amount).toBe(0);
  });

  test("salto de níveis concede todas as recompensas intermediárias uma vez", () => {
    const progressed = awardXP(baseState(), {
      amount: 1_000,
      reason: "weekly_mission",
      uniqueKey: "mission:semana-33",
      missionId: "semana-33",
      description: "Missão semanal",
      createdAt: "2026-08-15T12:00:00.000Z",
    });

    expect(progressed.level).toBe(6);
    expect(progressed.lastXpAward?.levelsGained).toEqual([2, 3, 4, 5, 6]);
    expect(progressed.rewardGrants.map((reward) => reward.rewardId)).toEqual(
      expect.arrayContaining([
        "badge-primeiros-passos",
        "tema-editor-aurora",
        "tokens-nivel-5",
      ]),
    );
    expect(progressed.helpTokens).toBe(2);
    expect(
      progressed.userLanguages.map((language) => language.languageId),
    ).not.toContain("python");
  });

  test("Python e Java exigem plano, nível e domínio", () => {
    const withPythonSkills = baseState({
      userSkills: {
        variaveis: skill("variaveis", 45),
        condicoes: skill("condicoes", 40),
      },
    });
    const levelFive = awardXP(withPythonSkills, {
      amount: 700,
      reason: "weekly_mission",
      uniqueKey: "level-five",
      description: "Teste de nível",
    });
    expect(
      levelFive.userLanguages.map((language) => language.languageId),
    ).not.toContain("python");

    const premiumLevelFive = reconcileProgressionState({
      ...levelFive,
      user: { ...levelFive.user, plan: "pro" },
    });
    expect(
      premiumLevelFive.userLanguages.map((language) => language.languageId),
    ).toContain("python");

    const javaRequirements = getLanguageRequirementProgress(
      premiumLevelFive,
      "java",
    );
    expect(javaRequirements.level.complete).toBe(false);
    expect(javaRequirements.canUnlock).toBe(false);

    const levelTenWithoutSkills = awardXP(premiumLevelFive, {
      amount: 2_000,
      reason: "project_completion",
      uniqueKey: "level-ten",
      description: "Projeto",
    });
    expect(levelTenWithoutSkills.level).toBe(10);
    expect(
      levelTenWithoutSkills.userLanguages.map(
        (language) => language.languageId,
      ),
    ).not.toContain("java");
  });

  test("plano Pro não ignora os requisitos pedagógicos", () => {
    const freeState = baseState();
    const proState = reconcileProgressionState(
      {
        ...freeState,
        user: { ...freeState.user, plan: "pro" },
      },
      "2026-08-15T12:00:00.000Z",
    );

    expect(
      proState.userLanguages.map((language) => language.languageId),
    ).toEqual(["javascript"]);
    expect(proState.level).toBe(1);
  });

  test("mastery responde à dificuldade, tentativas e recomenda revisão", () => {
    const easyExercise = exercises.find(
      (exercise) => exercise.id === "variaveis",
    )!;
    const hardExercise = exercises.find(
      (exercise) => exercise.id === "calculadora",
    )!;
    const easy = updateSkillMastery(baseState(), {
      exercise: easyExercise,
      passed: true,
      attemptNumber: 1,
      hintsUsed: 0,
      createdAt: "2026-08-15T12:00:00.000Z",
    });
    const hard = updateSkillMastery(baseState(), {
      exercise: hardExercise,
      passed: true,
      attemptNumber: 1,
      hintsUsed: 0,
      createdAt: "2026-08-15T12:00:00.000Z",
    });

    expect(easy.userSkills.variaveis.masteryScore).toBe(30);
    expect(hard.userSkills.decomposicao.masteryScore).toBe(44);
    const recommendation = getAdaptiveRecommendation(easy);
    expect(recommendation.title).toContain("Revisão de Variáveis");
    expect(recommendation.reason).toContain("30%");
  });
});

test.describe("telas de progressão", () => {
  test("linguagens, habilidades e recompensas usam o estado persistido", async ({
    page,
  }) => {
    await page.goto("/linguagens");
    await expect(
      page.getByRole("heading", { name: "JavaScript" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Linguagem principal" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Python" })).toBeVisible();
    await expect(
      page
        .locator(".language-card")
        .filter({ has: page.getByRole("heading", { name: "Python" }) })
        .getByText(/0 de 3 concluídos/),
    ).toBeVisible();

    await page.goto("/habilidades");
    await expect(page.locator(".skill-card")).toHaveCount(11);
    await expect(
      page.getByText("Nenhuma evidência registrada").first(),
    ).toBeVisible();

    await page.goto("/recompensas");
    await expect(page.getByRole("heading", { name: "Nível 1" })).toBeVisible();
    await expect(
      page
        .locator(".xp-ledger .progression-empty p")
        .filter({
          hasText:
            "Conclua uma atividade válida para criar a primeira transação.",
        })
        .first(),
    ).toBeVisible();
  });

  test("missão, projeto, relatório e conquistas usam somente atividades reais", () => {
    const state = baseState({
      level: 3,
      activeDays: ["2026-08-10", "2026-08-12"],
      attemptHistory: [
        {
          id: "project-step",
          exerciseId: "variaveis",
          code: "const nome = 'Ada'",
          createdAt: "2026-08-12T15:00:00.000Z",
          passed: true,
          passedTests: 3,
          failedTests: 0,
          testResults: [],
          hintsUsed: 0,
          tutorMessageIds: [],
          attemptNumber: 1,
          activityMode: "project",
          projectId: "calculadora",
        },
      ],
      xpTransactions: [
        {
          id: "xp-1",
          amount: 10,
          reason: "exercise_completion",
          uniqueKey: "exercise:variaveis:completion",
          exerciseId: "variaveis",
          description: "Conclusão",
          createdAt: "2026-08-12T15:00:00.000Z",
        },
        {
          id: "xp-2",
          amount: 10,
          reason: "no_hint",
          uniqueKey: "exercise:variaveis:no-hint",
          exerciseId: "variaveis",
          description: "Sem dicas",
          createdAt: "2026-08-12T15:00:00.000Z",
        },
      ],
    });
    const date = new Date("2026-08-15T15:00:00.000Z");
    const mission = getWeeklyMissionProgress(state, date);
    const project = getProjectProgress(state, "calculadora");
    const report = getWeeklyReport(state, date);
    const achievements = grantEligibleAchievements(
      state,
      "2026-08-15T15:00:00.000Z",
    );

    expect(mission.objectives.map((objective) => objective.current)).toEqual([
      1, 0, 1,
    ]);
    expect(mission.complete).toBe(false);
    expect(project.completedSteps).toBe(1);
    expect(project.complete).toBe(false);
    expect(report).toMatchObject({
      activeDays: 2,
      attempts: 1,
      exercisesSolved: 1,
      xp: 20,
      accuracy: 100,
      hintsUsed: 0,
    });
    expect(achievements.rewardGrants.map((grant) => grant.rewardId)).toEqual(
      expect.arrayContaining([
        "achievement-primeira-solucao",
        "achievement-sem-ajuda",
      ]),
    );
  });

  test("prática, missões, projetos e relatório possuem fluxos navegáveis", async ({
    page,
  }) => {
    await page.goto("/praticar");
    await expect(page.locator(".practice-exercise-card")).toHaveCount(14);
    await page
      .locator(".practice-exercise-card")
      .filter({ hasText: "Repetir sem copiar" })
      .getByRole("button", { name: "Praticar" })
      .click();
    await expect(page).toHaveURL(/\/treino\/loops\?modo=pratica/);
    await expect(
      page.getByText(/Prática livre · progresso separado/),
    ).toBeVisible();

    await page.goto("/missoes");
    await expect(
      page.getByRole("heading", { name: "Missão da semana" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resgatar recompensa" }),
    ).toBeDisabled();

    await page.goto("/projetos");
    await expect(
      page.getByRole("heading", { name: "Calculadora confiável" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Concluir projeto" }).first(),
    ).toBeDisabled();

    await page.goto("/relatorio");
    await expect(
      page.getByRole("heading", {
        name: "Seus dados, sem números inventados.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Taxa de acerto").first()).toBeVisible();

    await page.goto("/prova");
    await expect(
      page.getByRole("heading", { name: "Modo prova sem punição." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Responder" }).first().click();
    await expect(page).toHaveURL(/\/treino\/variaveis\?modo=prova/);
    await expect(
      page.getByText(/Modo prova · dicas e tutor pausados/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tutor", exact: true }),
    ).toHaveCount(0);
  });
});
