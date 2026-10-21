import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { exercises } from "@/lib/content";
import {
  getBrasiliaDateKey,
  getWorkoutForExercise,
  isUserWorkoutUnlocked,
} from "@/lib/daily-workouts";
import { getPrisma } from "@/services/persistence/database";
import {
  catalog,
  type AttemptSession,
} from "@/services/attempts/attempt-store";
import { getPlanLimits } from "@/services/entitlements/entitlements";
import { getExerciseSkillId } from "@/services/gamification/mastery";
import type { Exercise, TutorMessage } from "@/lib/types";
import {
  configuredChatProvider,
  tutorConfiguration,
  type ChatContext,
} from "./chat-provider";
import {
  CHAT_POLICY_VERSION,
  PARTIAL_GUIDANCE,
  protectReply,
  requestsSolution,
  safeContextText,
} from "./chat-policy";

export class ChatError extends Error {
  constructor(
    message: string,
    public status = 400,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
export type ChatInput = {
  exerciseId: string;
  requestId: string;
  message: string;
  code: string;
  intent: "question" | "hint" | "explain-error" | "analyze-logic" | "confused";
  browserError?: string;
};
export function parseChatInput(body: unknown): ChatInput {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ChatError("Dados inválidos.");
  const b = body as Record<string, unknown>;
  if (
    Object.keys(b).some(
      (key) =>
        ![
          "exerciseId",
          "requestId",
          "message",
          "code",
          "intent",
          "browserError",
        ].includes(key),
    )
  )
    throw new ChatError(
      "Envie apenas mensagem, exercício e código. Papéis e identidade vêm do servidor.",
    );
  if (
    typeof b.exerciseId !== "string" ||
    b.exerciseId.length > 100 ||
    !exercises.some((e) => e.id === b.exerciseId)
  )
    throw new ChatError("Exercício inválido.");
  if (
    typeof b.requestId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      b.requestId,
    )
  )
    throw new ChatError("Identificador inválido.");
  if (
    typeof b.message !== "string" ||
    !b.message.trim() ||
    b.message.length > 2000 ||
    typeof b.code !== "string" ||
    b.code.length > 12_000
  )
    throw new ChatError(
      "Use até 2.000 caracteres na mensagem e 12.000 no código.",
      413,
    );
  if (
    b.browserError !== undefined &&
    (typeof b.browserError !== "string" || b.browserError.length > 400)
  )
    throw new ChatError("Erro relatado fora do limite.");
  const intent = b.intent ?? "question";
  if (
    ![
      "question",
      "hint",
      "explain-error",
      "analyze-logic",
      "confused",
    ].includes(String(intent))
  )
    throw new ChatError("Tipo de pergunta inválido.");
  return {
    exerciseId: b.exerciseId,
    requestId: b.requestId,
    message: b.message.trim(),
    code: b.code,
    intent: intent as ChatInput["intent"],
    ...(typeof b.browserError === "string"
      ? { browserError: b.browserError }
      : {}),
  };
}
type Tx = Prisma.TransactionClient;
async function validateSession(tx: Tx, session: AttemptSession) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${session.userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "UserSession" WHERE id=${session.sessionId} FOR UPDATE`;
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
    throw new ChatError("Entre novamente e confirme seu e-mail.", 401);
}
async function accessible(userId: string, exercise: Exercise) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  if (!user) throw new ChatError("Conta não encontrada.", 401);
  const pro =
    user.subscription?.plan === "PRO" &&
    (user.subscription.status === "ACTIVE" ||
      (user.subscription.status === "CANCELED" &&
        (user.subscription.currentPeriodEnd?.getTime() ?? 0) > Date.now()));
  if (
    exercises.findIndex((e) => e.id === exercise.id) >=
    getPlanLimits(pro ? "pro" : "free").exercises
  )
    throw new ChatError("Este exercício exige o plano correspondente.", 403);
  const workout = getWorkoutForExercise(exercise.id);
  if (
    workout &&
    !isUserWorkoutUnlocked(workout, getBrasiliaDateKey(user.createdAt))
  )
    throw new ChatError("Este exercício ainda não foi liberado.", 403);
  return pro ? ("pro" as const) : ("free" as const);
}
function publicMessage(
  row: {
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    helpLevel: number | null;
    errorKind: string | null;
  },
  exerciseId: string,
): TutorMessage {
  return {
    id: row.id,
    exerciseId,
    role: row.role === "student" ? "student" : "tutor",
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    ...(row.helpLevel && row.helpLevel < 5
      ? { helpLevel: row.helpLevel as 1 | 2 | 3 | 4 }
      : {}),
  };
}
export async function readChat(userId: string, exerciseId: string) {
  const exercise = exercises.find((e) => e.id === exerciseId);
  if (!exercise) throw new ChatError("Exercício inválido.");
  await accessible(userId, exercise);
  const rows = await getPrisma().tutorMessage.findMany({
    where: {
      userId,
      exercise: { slug: exerciseId },
      id: { startsWith: "chat-" },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return rows.reverse().map((row) => publicMessage(row, exerciseId));
}
export function assembleContext(
  exercise: Exercise,
  input: ChatInput,
  history: TutorMessage[],
  official: {
    level: number;
    mastery: number;
    attempt: unknown;
    hintStep: number;
  },
): ChatContext {
  const safe = (value: string, n: number) =>
    safeContextText(value, exercise, n);
  const limited: ChatContext["history"] = [];
  let size = 0;
  for (const message of history.slice(-12).reverse()) {
    const content = safe(message.content, 700);
    if (size + content.length > 7000) break;
    limited.unshift({
      role: message.role === "student" ? "user" : "assistant",
      content,
    });
    size += content.length;
  }
  return {
    exercise: {
      title: exercise.title,
      objective: exercise.objective,
      concept: exercise.concept,
      requirements: exercise.instructions.map((i) => safe(i, 400)).slice(0, 8),
    },
    level: official.level,
    mastery: official.mastery,
    hintStep: official.hintStep,
    code: safe(input.code, 12000),
    officialAttempt: official.attempt,
    browserError: input.browserError ? safe(input.browserError, 400) : null,
    history: limited,
    historySummary: {
      omittedMessages: Math.max(0, history.length - limited.length),
      concept: exercise.concept,
      hintStep: official.hintStep,
    },
    message: safe(input.message, 2000),
  };
}
export async function sendChat(
  session: AttemptSession,
  input: ChatInput,
  signal: AbortSignal,
) {
  const provider = configuredChatProvider();
  if (!provider)
    throw new ChatError(
      "Tutor IA não configurado. Configure o provider e o modelo no servidor.",
      503,
    );
  const exercise = exercises.find((e) => e.id === input.exerciseId)!;
  const plan = await accessible(session.userId, exercise);
  const db = getPrisma();
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const hashTag = `${CHAT_POLICY_VERSION}:${hash}`;
  const started = Date.now();
  const reserved = await db.$transaction(async (tx) => {
    // One shared, durable budget lock across users/processes; never held during generation.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(7420137)::text AS locked`;
    await validateSession(tx, session);
    const previous = await tx.tutorUsage.findUnique({
      where: { id: input.requestId },
    });
    if (previous) {
      if (
        previous.userId !== session.userId ||
        previous.exerciseId !== input.exerciseId ||
        !previous.errorCode?.endsWith(hashTag)
      )
        throw new ChatError("Identificador já utilizado.", 409);
      if (previous.success) return false;
      throw new ChatError(
        "Esta solicitação já foi iniciada. Aguarde ou envie uma nova tentativa.",
        409,
      );
    }
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const month = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const limit = getPlanLimits(plan).tutorRequestsPerDay;
    const daily = await tx.tutorUsage.count({
      where: {
        userId: session.userId,
        createdAt: { gte: day },
        promptVersion: CHAT_POLICY_VERSION,
      },
    });
    const monthly = await tx.tutorUsage.count({
      where: {
        userId: session.userId,
        createdAt: { gte: month },
        promptVersion: CHAT_POLICY_VERSION,
      },
    });
    const global = await tx.tutorUsage.count({
      where: { createdAt: { gte: day }, promptVersion: CHAT_POLICY_VERSION },
    });
    const globalMonthly = await tx.tutorUsage.count({
      where: { createdAt: { gte: month }, promptVersion: CHAT_POLICY_VERSION },
    });
    const configuredGlobal = Number(
      process.env.TUTOR_GLOBAL_DAILY_LIMIT ?? 100,
    );
    const globalLimit =
      Number.isSafeInteger(configuredGlobal) && configuredGlobal > 0
        ? Math.min(1000, configuredGlobal)
        : 100;
    if (
      daily >= limit ||
      monthly >= (plan === "pro" ? 400 : 40) ||
      global >= globalLimit ||
      globalMonthly >= 1000
    )
      throw new ChatError(
        "Limite de uso do Tutor atingido. Tente mais tarde.",
        429,
        3600,
      );
    if (
      await tx.tutorUsage.count({
        where: {
          userId: session.userId,
          success: false,
          errorCode: { startsWith: "pending:" },
          createdAt: { gte: new Date(Date.now() - 45_000) },
          promptVersion: CHAT_POLICY_VERSION,
        },
      })
    )
      throw new ChatError("Uma resposta já está em andamento.", 409);
    await tx.tutorUsage.create({
      data: {
        id: input.requestId,
        userId: session.userId,
        exerciseId: input.exerciseId,
        model: provider.name,
        promptVersion: CHAT_POLICY_VERSION,
        requestType: input.intent,
        durationMs: 0,
        success: false,
        errorCode: `pending:${hashTag}`,
      },
    });
    return true;
  });
  if (!reserved)
    return {
      messages: await readChat(session.userId, input.exerciseId),
      mode: tutorConfiguration().mode,
      replayed: true,
    };
  try {
    const history = await readChat(session.userId, input.exerciseId);
    const progress = await db.userProgress.findUnique({
      where: { userId: session.userId },
      select: { currentLevel: true, authoritativeState: true },
    });
    const latest = await db.attempt.findFirst({
      where: { userId: session.userId, exercise: { slug: input.exerciseId } },
      orderBy: { createdAt: "desc" },
      select: {
        code: true,
        passed: true,
        passedTests: true,
        failedTests: true,
        testResults: true,
        evaluationStatus: true,
      },
    });
    const skills = (
      progress?.authoritativeState as {
        userSkills?: Record<string, { masteryScore?: number }>;
      } | null
    )?.userSkills;
    const hintStep = Math.min(
      3,
      1 +
        (await db.tutorUsage.count({
          where: {
            userId: session.userId,
            exerciseId: input.exerciseId,
            requestType: "hint",
            success: true,
            promptVersion: CHAT_POLICY_VERSION,
          },
        })),
    );
    // Explicit whitelist: no code, reference, expected outputs or official result object from Attempt.
    const attempt = latest
      ? {
          passed: latest.passed,
          codeMatchesCurrent: latest.code === input.code,
          passedTests: latest.passedTests,
          failedTests: latest.failedTests,
          evaluationStatus: latest.evaluationStatus,
          failedBehaviors: Array.isArray(latest.testResults)
            ? latest.testResults
                .filter(
                  (t) =>
                    t &&
                    typeof t === "object" &&
                    !(t as { passed?: boolean }).passed,
                )
                .slice(0, 3)
                .map((t) =>
                  safeContextText(
                    String(
                      (t as { label?: string }).label ??
                        "Comportamento a revisar",
                    ),
                    exercise,
                    180,
                  ),
                )
            : [],
        }
      : null;
    const context = assembleContext(exercise, input, history, {
      level: progress?.currentLevel ?? 1,
      mastery: skills?.[getExerciseSkillId(exercise)]?.masteryScore ?? 0,
      hintStep,
      attempt,
    });
    const timeout = AbortSignal.timeout(25_000);
    const combined = AbortSignal.any([signal, timeout]);
    combined.throwIfAborted();
    let tokens = { inputTokens: 0, outputTokens: 0 };
    let text = PARTIAL_GUIDANCE;
    let filtered = requestsSolution(input.message);
    if (!filtered) {
      const reply = await provider.generate(context, combined);
      tokens = reply;
      const checked = protectReply(
        reply.text,
        exercise,
        history.filter((m) => m.role === "tutor").map((m) => m.content),
      );
      text = checked.text;
      filtered = checked.filtered;
    }
    combined.throwIfAborted();
    await db.$transaction(async (tx) => {
      await validateSession(tx, session);
      const entry = await catalog(tx, exercise);
      const pending = await tx.tutorUsage.findUnique({
        where: { id: input.requestId },
      });
      if (pending?.errorCode !== `pending:${hashTag}`)
        throw new ChatError("Solicitação encerrada.", 409);
      await tx.tutorMessage.createMany({
        data: [
          {
            id: `chat-${input.requestId}-student`,
            userId: session.userId,
            exerciseId: entry.dbExercise.id,
            role: "student",
            content: input.message,
            createdAt: new Date(started),
          },
          {
            id: `chat-${input.requestId}-tutor`,
            userId: session.userId,
            exerciseId: entry.dbExercise.id,
            role: "tutor",
            content: text,
            helpLevel: Math.min(4, hintStep),
            createdAt: new Date(),
          },
        ],
      });
      await tx.tutorUsage.update({
        where: { id: input.requestId },
        data: {
          success: true,
          durationMs: Date.now() - started,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          errorCode: `${filtered ? "filtered" : "complete"}:${hashTag}`,
        },
      });
    });
    return {
      messages: await readChat(session.userId, input.exerciseId),
      mode: tutorConfiguration().mode,
      safetyFiltered: filtered,
      replayed: false,
    };
  } catch (error) {
    await db.tutorUsage.updateMany({
      where: { id: input.requestId, userId: session.userId, success: false },
      data: {
        durationMs: Date.now() - started,
        errorCode: `failed:${hashTag}`,
      },
    });
    if (error instanceof ChatError) throw error;
    throw new ChatError(
      signal.aborted
        ? "Geração interrompida. Seu texto foi mantido."
        : "Tutor indisponível no momento. Seu texto foi mantido; tente novamente.",
      signal.aborted ? 499 : 503,
    );
  }
}
