import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma } from "@prisma/client";
import { initialState } from "@/lib/initial-state";
import { exercises } from "@/lib/content";
import {
  getBrasiliaDateKey,
  getWorkoutForExercise,
  isUserWorkoutUnlocked,
} from "@/lib/daily-workouts";
import { getProgressMetrics } from "@/lib/progress";
import { PROJECT_CATALOG, type ProjectId } from "@/lib/learning-program";
import { SKILL_CATALOG } from "@/lib/gamification-config";
import {
  emptyTrustedProgress,
  trustedFields,
  type OfficialProgress,
  type TrustedFields,
} from "@/lib/trusted-progress";
import type { AppState, AttemptRecord, Exercise } from "@/lib/types";
import {
  databasePersistenceMode,
  getPrisma,
} from "@/services/persistence/database";
import { getProjectProgress } from "@/services/learning/learning-program";
import { assessSubmission } from "./static-assessment";
import { transitionAttempt, transitionClaim } from "./progress-transition";

export class AttemptError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export type Submission = {
  exerciseId: string;
  code: string;
  idempotencyKey: string;
  activityMode?: "path" | "practice" | "project" | "assessment";
  projectId?: string;
  assessmentId?: string;
};
export type AttemptReceipt = {
  attempt: AttemptRecord;
  evaluationStatus: "verified" | "failed" | "pending";
  firstCompletion: boolean;
  xpAwarded: number;
  message: string;
};
export type AttemptResponse = AttemptReceipt & {
  official: OfficialProgress;
  replayed: boolean;
};
export type AttemptSession = { userId: string; sessionId: string };
type Tx = Prisma.TransactionClient;
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export function parseSubmission(value: unknown): Submission {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AttemptError("Tentativa inválida.", 400);
  const data = value as Record<string, unknown>;
  const allowed = [
    "exerciseId",
    "code",
    "idempotencyKey",
    "activityMode",
    "projectId",
    "assessmentId",
  ];
  if (Object.keys(data).some((key) => !allowed.includes(key)))
    throw new AttemptError(
      "Não envie identidade, resultados, testes ou recompensas. Esses valores pertencem ao servidor.",
      400,
    );
  if (
    typeof data.exerciseId !== "string" ||
    !exercises.some((e) => e.id === data.exerciseId) ||
    typeof data.code !== "string" ||
    data.code.length > 20_000 ||
    !data.code.trim() ||
    typeof data.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(data.idempotencyKey) ||
    (data.activityMode !== undefined &&
      !["path", "practice", "project", "assessment"].includes(
        String(data.activityMode),
      )) ||
    [data.projectId, data.assessmentId].some(
      (v) => v !== undefined && (typeof v !== "string" || v.length > 100),
    )
  )
    throw new AttemptError(
      "Revise o exercício, o código e a chave da tentativa.",
      400,
    );
  return {
    exerciseId: data.exerciseId,
    code: data.code,
    idempotencyKey: data.idempotencyKey,
    activityMode: (data.activityMode ?? "path") as Submission["activityMode"],
    projectId: data.projectId as string | undefined,
    assessmentId: data.assessmentId as string | undefined,
  };
}

function database() {
  if (databasePersistenceMode() !== "postgres")
    throw new AttemptError(
      "O registro oficial de progresso exige PostgreSQL. Seus rascunhos continuam locais.",
      503,
    );
  return getPrisma();
}

async function stateFor(tx: Tx, userId: string) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    include: { profile: true, progress: true, subscription: true },
  });
  const trusted = user.progress?.authoritativeState as TrustedFields | null;
  const trainingStartedOn = getBrasiliaDateKey(user.createdAt);
  const state: AppState = {
    ...initialState,
    ...(trusted ?? emptyTrustedProgress()),
    user: {
      ...initialState.user,
      accountId: userId,
      name: user.profile?.name ?? "",
      email: user.email,
      role: user.role === "ADMIN" ? "admin" : "student",
      plan:
        user.subscription?.plan === "PRO" &&
        (user.subscription.status === "ACTIVE" ||
          (user.subscription.status === "CANCELED" &&
            user.subscription.currentPeriodEnd &&
            user.subscription.currentPeriodEnd.getTime() > Date.now()))
          ? "pro"
          : "free",
      trainingStartedOn,
    },
  };
  const metrics = getProgressMetrics(state);
  state.streak = metrics.streak;
  state.longestStreak = metrics.longestStreak;
  return { state, revision: user.progress?.revision ?? 0 };
}
function official(
  userId: string,
  state: AppState,
  revision: number,
): OfficialProgress {
  return {
    ownerId: userId,
    revision,
    trainingStartedOn: state.user.trainingStartedOn!,
    progress: trustedFields(state),
  };
}
export async function readOfficialProgress(userId: string) {
  const prisma = database();
  const { state, revision } = await stateFor(prisma, userId);
  return official(userId, state, revision);
}

async function lockSession(tx: Tx, session: AttemptSession) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${session.userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "UserSession" WHERE id = ${session.sessionId} FOR UPDATE`;
  const valid = await tx.userSession.findFirst({
    where: {
      id: session.sessionId,
      userId: session.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { emailVerifiedAt: { not: null } },
    },
  });
  if (!valid)
    throw new AttemptError("Entre novamente e confirme seu e-mail.", 401);
}

export async function catalog(tx: Tx, exercise: Exercise) {
  const path = await tx.learningPath.upsert({
    where: { slug: "logiclab-official-javascript" },
    update: {},
    create: {
      slug: "logiclab-official-javascript",
      title: "JavaScript",
      description: "Catálogo oficial de exercícios",
      order: 1,
      status: "PUBLISHED",
    },
  });
  const level = await tx.level.upsert({
    where: { learningPathId_order: { learningPathId: path.id, order: 1 } },
    update: {},
    create: {
      learningPathId: path.id,
      order: 1,
      title: "Fundamentos",
      description: "Exercícios oficiais",
    },
  });
  const lesson = await tx.lesson.upsert({
    where: { slug: "logiclab-official-fundamentals" },
    update: {},
    create: {
      slug: "logiclab-official-fundamentals",
      title: "Fundamentos",
      summary: "Prática oficial",
      content: {},
      estimatedMinutes: 25,
      order: 1,
      levelId: level.id,
      status: "PUBLISHED",
    },
  });
  const dbExercise = await tx.exercise.upsert({
    where: { slug: exercise.id },
    update: {},
    create: {
      slug: exercise.id,
      lessonId: lesson.id,
      title: exercise.title,
      description: exercise.objective,
      concept: exercise.concept,
      difficulty:
        exercise.difficulty === "Fácil"
          ? "EASY"
          : exercise.difficulty === "Médio"
            ? "MEDIUM"
            : "HARD",
      starterCode: exercise.starterCode,
      solutionCode: exercise.solution,
      explanation: exercise.explanation,
      xp: exercise.xp,
      order: exercises.findIndex((e) => e.id === exercise.id) + 1,
      status: "PUBLISHED",
    },
  });
  if (
    dbExercise.status !== "PUBLISHED" ||
    dbExercise.solutionCode !== exercise.solution
  )
    throw new AttemptError(
      "A versão publicada deste exercício precisa ser reconciliada antes da avaliação.",
      409,
    );
  const version = await tx.exerciseVersion.upsert({
    where: { exerciseId_version: { exerciseId: dbExercise.id, version: 1 } },
    update: {},
    create: {
      exerciseId: dbExercise.id,
      version: 1,
      status: "PUBLISHED",
      title: exercise.title,
      description: exercise.objective,
      difficulty: dbExercise.difficulty,
      starterCode: exercise.starterCode,
      solutionCode: exercise.solution,
      explanation: exercise.explanation,
      tests: json(exercise.tests),
      hints: json(exercise.hints),
      xp: exercise.xp,
      publishedAt: new Date(),
    },
  });
  if (
    version.solutionCode !== exercise.solution ||
    !isDeepStrictEqual(version.tests, json(exercise.tests))
  )
    throw new AttemptError("Versão de avaliação divergente.", 409);
  return { path, lesson, dbExercise, version };
}

async function persist(
  tx: Tx,
  userId: string,
  previous: AppState,
  next: AppState,
  pathId: string,
  revision: number,
) {
  const existing = new Set(
    previous.xpTransactions.map((entry) => entry.uniqueKey),
  );
  for (const entry of next.xpTransactions.filter(
    (entry) => !existing.has(entry.uniqueKey),
  )) {
    await tx.xPTransaction.create({
      data: { ...entry, userId, createdAt: new Date(entry.createdAt) },
    });
  }
  const average = Object.values(next.userSkills);
  await tx.userProgress.upsert({
    where: { userId },
    create: {
      userId,
      learningPathId: pathId,
      totalXp: next.xp,
      currentLevel: next.level,
      masteryScore: average.length
        ? average.reduce((n, s) => n + s.masteryScore, 0) / average.length
        : 0,
      authoritativeState: json(trustedFields(next)),
      revision: revision + 1,
    },
    update: {
      totalXp: next.xp,
      currentLevel: next.level,
      masteryScore: average.length
        ? average.reduce((n, s) => n + s.masteryScore, 0) / average.length
        : 0,
      authoritativeState: json(trustedFields(next)),
      revision: revision + 1,
    },
  });
  await tx.streak.upsert({
    where: { userId },
    create: {
      userId,
      current: next.streak,
      longest: next.longestStreak,
      activeDays: json(next.activeDays),
      lastActiveDay: next.activeDays.length
        ? new Date(next.activeDays.at(-1)! + "T12:00:00Z")
        : null,
    },
    update: {
      current: next.streak,
      longest: next.longestStreak,
      activeDays: json(next.activeDays),
      lastActiveDay: next.activeDays.length
        ? new Date(next.activeDays.at(-1)! + "T12:00:00Z")
        : null,
    },
  });
  for (const progress of Object.values(next.userSkills)) {
    const definition = SKILL_CATALOG.find((s) => s.id === progress.skillId);
    const skill = await tx.skill.upsert({
      where: { slug: progress.skillId },
      update: {},
      create: {
        slug: progress.skillId,
        title: definition?.title ?? progress.skillId,
        description: definition?.title ?? progress.skillId,
      },
    });
    const data = {
      masteryScore: progress.masteryScore,
      attempts: progress.attempts,
      correctAttempts: progress.correctAttempts,
      hintsUsed: progress.hintsUsed,
      evidence: json(progress.evidence),
      lastPracticedAt: progress.lastPracticedAt
        ? new Date(progress.lastPracticedAt)
        : null,
    };
    await tx.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: skill.id } },
      create: { userId, skillId: skill.id, ...data },
      update: data,
    });
  }
  for (const grant of next.rewardGrants) {
    const reward = await tx.reward.upsert({
      where: { slug: grant.rewardId },
      update: {},
      create: {
        slug: grant.rewardId,
        title: grant.title,
        description: grant.title,
        type: grant.type.toUpperCase() as
          | "BADGE"
          | "THEME"
          | "LANGUAGE"
          | "TOKENS"
          | "CHALLENGE"
          | "PROJECT",
        payload: json({ amount: grant.amount }),
      },
    });
    await tx.userReward.upsert({
      where: { userId_rewardId: { userId, rewardId: reward.id } },
      update: {},
      create: {
        userId,
        rewardId: reward.id,
        source: "official_progress",
        grantedAt: new Date(grant.grantedAt),
      },
    });
    if (grant.type === "tokens" && grant.amount)
      await tx.helpTokenTransaction.upsert({
        where: {
          userId_uniqueKey: { userId, uniqueKey: `reward:${grant.rewardId}` },
        },
        update: {},
        create: {
          userId,
          amount: grant.amount,
          reason: "level_reward",
          uniqueKey: `reward:${grant.rewardId}`,
        },
      });
  }
}

export async function submitAttempt(
  session: AttemptSession,
  input: Submission,
): Promise<AttemptResponse> {
  const exercise = exercises.find((e) => e.id === input.exerciseId)!;
  if (!exercise) throw new AttemptError("Exercício indisponível.", 404);
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        exerciseId: input.exerciseId,
        code: input.code,
        activityMode: input.activityMode ?? "path",
        projectId: input.projectId ?? null,
        assessmentId: input.assessmentId ?? null,
      }),
    )
    .digest("hex");
  const assessment = assessSubmission(input.code, exercise);
  return database().$transaction(
    async (tx) => {
      await lockSession(tx, session);
      const { state, revision } = await stateFor(tx, session.userId);
      const replay = await tx.attempt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: session.userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (replay) {
        if (replay.requestHash !== hash)
          throw new AttemptError(
            "Esta chave já identifica outro conteúdo de tentativa.",
            409,
          );
        return {
          ...(replay.officialResult as unknown as AttemptReceipt),
          official: official(session.userId, state, revision),
          replayed: true,
        };
      }
      if (input.activityMode === "project") {
        const project = PROJECT_CATALOG.find((p) => p.id === input.projectId);
        if (
          !project ||
          !project.steps.some((s) => s.exerciseId === exercise.id) ||
          !getProjectProgress(state, project.id as ProjectId).unlocked
        )
          throw new AttemptError(
            "Projeto indisponível para esta conta/exercício.",
            403,
          );
      }
      if (
        input.activityMode === "assessment" &&
        (input.assessmentId !== "fundamentos-javascript" ||
          !["variaveis", "condicoes", "loops"].includes(exercise.id))
      )
        throw new AttemptError(
          "Esta prova não inclui o exercício enviado.",
          403,
        );
      if (
        (input.activityMode ?? "path") === "path" &&
        state.user.role !== "admin"
      ) {
        const workout = getWorkoutForExercise(exercise.id);
        if (
          !workout ||
          !isUserWorkoutUnlocked(workout, state.user.trainingStartedOn)
        )
          throw new AttemptError(
            "Este treino ainda não foi liberado para a conta.",
            403,
          );
      }
      const entry = await catalog(tx, exercise);
      const max = await tx.attempt.aggregate({
        where: { userId: session.userId, exerciseId: entry.dbExercise.id },
        _max: { attemptNumber: true },
      });
      const now = new Date();
      const record: AttemptRecord = {
        id: randomUUID(),
        exerciseId: exercise.id,
        code: input.code,
        createdAt: now.toISOString(),
        passed: assessment.passed,
        passedTests: assessment.tests.filter((t) => t.passed).length,
        failedTests: assessment.tests.filter((t) => !t.passed).length,
        testResults: assessment.tests,
        hintsUsed: state.hintsUsed[exercise.id] ?? 0,
        tutorMessageIds: [],
        attemptNumber: (max._max.attemptNumber ?? 0) + 1,
        activityMode: input.activityMode ?? "path",
        projectId:
          input.activityMode === "project" ? input.projectId : undefined,
        assessmentId:
          input.activityMode === "assessment" ? input.assessmentId : undefined,
      };
      const next = transitionAttempt(
        state,
        exercise,
        record,
        assessment.status !== "pending",
        now,
      );
      const receipt: AttemptReceipt = {
        attempt: record,
        evaluationStatus: assessment.status,
        firstCompletion:
          next.completedExercises.length > state.completedExercises.length,
        xpAwarded: next.xp - state.xp,
        message: assessment.message,
      };
      await tx.attempt.create({
        data: {
          id: record.id,
          userId: session.userId,
          exerciseId: entry.dbExercise.id,
          exerciseVersionId: entry.version.id,
          idempotencyKey: input.idempotencyKey,
          requestHash: hash,
          evaluationStatus: assessment.status,
          officialResult: json(receipt),
          code: input.code,
          passed: record.passed,
          passedTests: record.passedTests,
          failedTests: record.failedTests,
          testResults: json(assessment.tests),
          hintsUsed: record.hintsUsed,
          attemptNumber: record.attemptNumber,
          createdAt: now,
        },
      });
      const completed = next.completedExercises.includes(exercise.id);
      await tx.exerciseProgress.upsert({
        where: {
          userId_exerciseId: {
            userId: session.userId,
            exerciseId: entry.dbExercise.id,
          },
        },
        create: {
          userId: session.userId,
          exerciseId: entry.dbExercise.id,
          attemptCount: record.attemptNumber,
          status: completed ? "COMPLETED" : "IN_PROGRESS",
          bestScore: record.passed ? 1 : 0,
          completedAt: completed ? now : null,
        },
        update: {
          attemptCount: record.attemptNumber,
          status: completed ? "COMPLETED" : "IN_PROGRESS",
          ...(record.passed ? { bestScore: 1 } : {}),
          ...(receipt.firstCompletion ? { completedAt: now } : {}),
        },
      });
      await persist(tx, session.userId, state, next, entry.path.id, revision);
      const score = next.completedExercises.length / exercises.length;
      await tx.lessonProgress.upsert({
        where: {
          userId_lessonId: {
            userId: session.userId,
            lessonId: entry.lesson.id,
          },
        },
        create: {
          userId: session.userId,
          lessonId: entry.lesson.id,
          status: score === 1 ? "COMPLETED" : "IN_PROGRESS",
          score,
          startedAt: now,
          completedAt: score === 1 ? now : null,
        },
        update: {
          score,
          status: score === 1 ? "COMPLETED" : "IN_PROGRESS",
          completedAt: score === 1 ? now : null,
        },
      });
      return {
        ...receipt,
        official: official(session.userId, next, revision + 1),
        replayed: false,
      };
    },
    { maxWait: 15_000, timeout: 20_000 },
  );
}

export async function claimOfficialReward(
  session: AttemptSession,
  projectId?: string,
) {
  return database().$transaction(
    async (tx) => {
      await lockSession(tx, session);
      const { state, revision } = await stateFor(tx, session.userId);
      if (projectId && !PROJECT_CATALOG.some((p) => p.id === projectId))
        throw new AttemptError("Projeto inválido.", 400);
      const next = transitionClaim(state, projectId);
      if (next === state) return official(session.userId, state, revision);
      const entry = await catalog(tx, exercises[0]);
      await persist(tx, session.userId, state, next, entry.path.id, revision);
      return official(session.userId, next, revision + 1);
    },
    { maxWait: 15_000, timeout: 20_000 },
  );
}

export async function revealOfficialHint(
  session: AttemptSession,
  exerciseId: string,
) {
  const exercise = exercises.find((item) => item.id === exerciseId);
  if (!exercise) throw new AttemptError("Exercício inválido.", 400);
  return database().$transaction(
    async (tx) => {
      await lockSession(tx, session);
      const { state, revision } = await stateFor(tx, session.userId);
      const count = Math.min(
        exercise.hints.length,
        (state.hintsUsed[exerciseId] ?? 0) + 1,
      );
      const next = {
        ...state,
        hintsUsed: { ...state.hintsUsed, [exerciseId]: count },
      };
      const entry = await catalog(tx, exercise);
      await persist(tx, session.userId, state, next, entry.path.id, revision);
      return {
        hintCount: count,
        official: official(session.userId, next, revision + 1),
      };
    },
    { maxWait: 15_000, timeout: 20_000 },
  );
}
