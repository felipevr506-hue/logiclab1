import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { AuthAccount } from "@/services/auth/auth-store";
import {
  hashPassword,
  hashToken,
  verifyPassword,
} from "@/services/auth/credentials";
import { getPrisma } from "@/services/persistence/database";

import { normalizeUsername, validateUsername } from "@/lib/auth-validation";
import {
  verificationStatus,
  VerificationRateError,
  type EmailVerificationResult,
} from "@/services/auth/verification-policy";

const SESSION_DAYS = 30;
const RESET_MINUTES = 30;
const EMAIL_VERIFICATION_HOURS = 24;

const userInclude = {
  profile: true,
  subscription: true,
} satisfies Prisma.UserInclude;

type StoredUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function effectivePlan(subscription: StoredUser["subscription"]) {
  if (!subscription || subscription.plan !== "PRO") return "FREE" as const;
  if (subscription.status === "ACTIVE") return "PRO" as const;
  if (
    subscription.status === "CANCELED" &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.getTime() > Date.now()
  ) {
    return "PRO" as const;
  }
  return "FREE" as const;
}

function toAccount(user: StoredUser): AuthAccount {
  return {
    id: user.id,
    name: user.profile?.name ?? "Aluno",
    username: user.username,
    email: user.email,
    passwordHash: user.passwordHash ?? "",
    role: user.role,
    plan: effectivePlan(user.subscription),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    onboardingCompleted: Boolean(user.profile?.onboardingAt),
    locale: user.profile?.locale ?? "pt-BR",
    initialLanguage: user.profile?.initialLanguage ?? "javascript",
    subscriptionStatus: user.subscription?.status ?? "FREE",
    currentPeriodEnd:
      user.subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd ?? false,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function sessionShape(session: {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}) {
  return {
    id: session.id,
    accountId: session.userId,
    tokenHash: session.tokenHash,
    userAgent: session.userAgent,
    createdAt: session.createdAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function createAccount(input: {
  name: string;
  username: string;
  email: string;
  password: string;
  termsAcceptedAt?: Date;
  termsVersion?: string;
  privacyVersion?: string;
}) {
  const prisma = getPrisma();
  const username = normalizeUsername(input.username);
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: {
        email: input.email.trim().toLowerCase(),
        username,
        passwordHash,
        termsAcceptedAt: input.termsAcceptedAt,
        termsVersion: input.termsVersion,
        privacyVersion: input.privacyVersion,
        profile: {
          create: { name: input.name.trim().slice(0, 80) },
        },
        subscription: {
          create: { plan: "FREE", planId: "free", status: "FREE" },
        },
      },
      include: userInclude,
    });
    return { ok: true as const, account: toAccount(user) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false as const, reason: "duplicate" as const };
    }
    throw error;
  }
}

export async function authenticateAccount(
  emailInput: string,
  password: string,
) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: emailInput.trim().toLowerCase() },
    include: userInclude,
  });
  const fallbackHash =
    "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? fallbackHash,
  );
  return valid && user ? toAccount(user) : null;
}

export async function createSession(accountId: string, userAgent: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const session = await getPrisma().userSession.create({
    data: {
      userId: accountId,
      tokenHash: hashToken(token),
      userAgent,
      expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
    },
  });
  return { token, session: sessionShape(session) };
}

export async function getSession(token: string | undefined) {
  if (!token) return null;
  const prisma = getPrisma();
  const stored = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: userInclude } },
  });
  if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now())
    return null;
  if (Date.now() - stored.lastSeenAt.getTime() > 5 * 60_000) {
    void prisma.userSession
      .update({ where: { id: stored.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
  return { account: toAccount(stored.user), session: sessionShape(stored) };
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  await getPrisma().userSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function listSessions(accountId: string) {
  const sessions = await getPrisma().userSession.findMany({
    where: {
      userId: accountId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: "desc" },
  });
  return sessions.map(sessionShape);
}

export async function revokeOtherSessions(
  accountId: string,
  currentId: string,
) {
  await getPrisma().userSession.updateMany({
    where: { userId: accountId, id: { not: currentId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function createPasswordReset(emailInput: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: emailInput.trim().toLowerCase() },
    select: { id: true },
  });
  if (!user) return null;
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + RESET_MINUTES * 60_000),
      },
    }),
  ]);
  return token;
}

export async function resetPassword(token: string, password: string) {
  const prisma = getPrisma();
  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!stored || stored.usedAt || stored.expiresAt.getTime() <= Date.now())
    return false;
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: stored.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!claimed.count) return false;
    await tx.user.update({
      where: { id: stored.userId },
      data: { passwordHash },
    });
    await tx.userSession.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return true;
  });
}

export async function changePassword(
  accountId: string,
  currentPassword: string,
  nextPassword: string,
) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: accountId },
    select: { passwordHash: true },
  });
  if (
    !user?.passwordHash ||
    !(await verifyPassword(currentPassword, user.passwordHash))
  ) {
    return false;
  }
  await prisma.user.update({
    where: { id: accountId },
    data: { passwordHash: await hashPassword(nextPassword) },
  });
  return true;
}

export async function changeEmail(
  accountId: string,
  emailInput: string,
  currentPassword: string,
) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: accountId },
    select: { passwordHash: true },
  });
  if (
    !user?.passwordHash ||
    !(await verifyPassword(currentPassword, user.passwordHash))
  ) {
    return false;
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: accountId },
        data: { email: emailInput.trim().toLowerCase(), emailVerifiedAt: null },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId: accountId, usedAt: null },
        data: { expiresAt: new Date() },
      });
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

export async function createEmailVerification(
  accountId: string,
  enforceCooldown = false,
  expectedEmail?: string,
) {
  return getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${accountId} FOR UPDATE`;
    const user = await tx.user.findUnique({
      where: { id: accountId },
      select: { emailVerifiedAt: true, email: true },
    });
    if (
      !user ||
      (expectedEmail && user.email !== expectedEmail) ||
      user.emailVerifiedAt
    )
      return null;
    const now = new Date();
    if (enforceCooldown) {
      const latest = await tx.emailVerificationToken.findFirst({
        where: { userId: accountId },
        orderBy: { createdAt: "desc" },
      });
      const elapsed = latest
        ? now.getTime() - latest.createdAt.getTime()
        : Infinity;
      if (elapsed < 60_000)
        throw new VerificationRateError(Math.ceil((60_000 - elapsed) / 1000));
      if (
        (await tx.emailVerificationToken.count({
          where: {
            userId: accountId,
            createdAt: { gt: new Date(now.getTime() - 3600_000) },
          },
        })) >= 5
      )
        throw new VerificationRateError(3600);
    }
    await tx.emailVerificationToken.updateMany({
      where: { userId: accountId, usedAt: null },
      data: { expiresAt: now },
    });
    const token = randomBytes(32).toString("base64url");
    await tx.emailVerificationToken.create({
      data: {
        userId: accountId,
        tokenHash: hashToken(token),
        expiresAt: new Date(
          now.getTime() + EMAIL_VERIFICATION_HOURS * 3600_000,
        ),
      },
    });
    return token;
  });
}

export async function verifyEmail(
  token: string,
): Promise<EmailVerificationResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const stored = await tx.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored) return "invalid";
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${stored.userId} FOR UPDATE`;
    const fresh = await tx.emailVerificationToken.findUnique({
      where: { id: stored.id },
    });
    const user = await tx.user.findUnique({
      where: { id: stored.userId },
      select: { emailVerifiedAt: true },
    });
    if (!fresh || !user) return "invalid";
    const status = verificationStatus(fresh, Boolean(user.emailVerifiedAt));
    if (status !== "verified") return status;
    await tx.emailVerificationToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });
    await tx.user.update({
      where: { id: stored.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return "verified";
  });
}

export async function exportAccount(accountId: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: accountId },
    include: {
      ...userInclude,
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: "desc" },
      },
    },
  });
  if (!user) return null;
  const account = toAccount(user);
  return {
    account: {
      id: account.id,
      name: account.name,
      username: account.username,
      email: account.email,
      role: account.role,
      plan: account.plan,
      emailVerifiedAt: account.emailVerifiedAt,
      termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
      termsVersion: user.termsVersion,
      privacyVersion: user.privacyVersion,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    },
    profile: user.profile,
    subscription: user.subscription,
    sessions: user.sessions.map((session) => {
      const { tokenHash: _secret, ...safe } = sessionShape(session);
      void _secret;
      return safe;
    }),
    exportedAt: new Date().toISOString(),
  };
}

export async function deleteAccount(accountId: string) {
  try {
    await getPrisma().user.delete({ where: { id: accountId } });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return false;
    }
    throw error;
  }
}

export async function updateOnboarding(
  accountId: string,
  input: {
    experience: string;
    goal: string;
    dailyMinutes: number;
    locale: string;
    initialLanguage: string;
  },
) {
  const profile = await getPrisma().profile.update({
    where: { userId: accountId },
    data: {
      experience: input.experience,
      goal: input.goal,
      dailyMinutes: input.dailyMinutes,
      locale: input.locale,
      initialLanguage: input.initialLanguage,
      onboardingAt: new Date(),
    },
  });
  return {
    experience: profile.experience ?? "",
    goal: profile.goal ?? "",
    dailyMinutes: profile.dailyMinutes,
    locale: profile.locale,
    initialLanguage: profile.initialLanguage,
    onboardingCompleted: Boolean(profile.onboardingAt),
  };
}

export async function updateProfile(
  accountId: string,
  input: {
    name: string;
    goal: string;
    dailyMinutes: number;
    studyDaysPerWeek: number;
    studyFocus: string;
  },
) {
  const profile = await getPrisma().profile.update({
    where: { userId: accountId },
    data: {
      name: input.name,
      goal: input.goal,
      dailyMinutes: input.dailyMinutes,
      studyDaysPerWeek: input.studyDaysPerWeek,
      studyFocus: input.studyFocus,
    },
  });
  return {
    name: profile.name,
    goal: profile.goal ?? "",
    dailyMinutes: profile.dailyMinutes,
    studyDaysPerWeek: profile.studyDaysPerWeek,
    studyFocus: profile.studyFocus,
  };
}
