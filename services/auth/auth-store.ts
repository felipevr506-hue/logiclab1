import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import {
  allowsLocalDevelopmentFeatures,
  isAutomatedTestHarness,
  isProductionLike,
} from "@/services/security/environment";
import { serverDataDirectory } from "@/services/persistence/server-data-directory";
import * as databaseAuth from "@/services/auth/database-auth-store";
import { databasePersistenceMode } from "@/services/persistence/database";
import {
  hashPassword,
  hashToken,
  verifyPassword,
} from "@/services/auth/credentials";

export { hashPassword, validatePassword } from "@/services/auth/credentials";

export const SESSION_COOKIE = isProductionLike()
  ? "__Host-logiclab_session"
  : "logiclab_session";
import { normalizeUsername, validateUsername } from "@/lib/auth-validation";
import {
  verificationStatus,
  VerificationRateError,
  type EmailVerificationResult,
} from "@/services/auth/verification-policy";

const SESSION_DAYS = 30;
const RESET_MINUTES = 30;
const EMAIL_VERIFICATION_HOURS = 24;

export type AccountRole = "STUDENT" | "ADMIN";
export type AuthAccount = {
  id: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: AccountRole;
  plan: "FREE" | "PRO";
  emailVerifiedAt: string | null;
  onboardingCompleted?: boolean;
  locale?: string;
  initialLanguage?: string;
  subscriptionStatus?:
    | "FREE"
    | "ACTIVE"
    | "PENDING"
    | "PAST_DUE"
    | "CANCELED"
    | "EXPIRED"
    | "REFUNDED";
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuthSession = {
  id: string;
  accountId: string;
  tokenHash: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

type ResetToken = {
  id: string;
  accountId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
};

type EmailVerificationToken = ResetToken;

type AuthDatabase = {
  accounts: AuthAccount[];
  sessions: AuthSession[];
  resetTokens: ResetToken[];
  emailVerificationTokens: EmailVerificationToken[];
};

const directory = serverDataDirectory("security");
const databaseFile = path.join(directory, "accounts.json");
let writeQueue = Promise.resolve();

function persistentAuth() {
  const mode = databasePersistenceMode();
  if (mode === "postgres") return databaseAuth;
  if (mode === "unavailable") {
    throw new Error(
      "Autenticação indisponível: configure DATABASE_URL no servidor.",
    );
  }
  return null;
}

const emptyDatabase = (): AuthDatabase => ({
  accounts: [],
  sessions: [],
  resetTokens: [],
  emailVerificationTokens: [],
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function readDatabase(): Promise<AuthDatabase> {
  try {
    const stored = JSON.parse(
      await readFile(databaseFile, "utf8"),
    ) as AuthDatabase;
    const now = Date.now();
    return {
      accounts: (stored.accounts ?? []).map((account, index) => ({
        ...account,
        username: account.username ?? `legacy_${index + 1}`,
        role: account.role === "ADMIN" ? "ADMIN" : "STUDENT",
        plan: account.plan === "PRO" ? "PRO" : "FREE",
        emailVerifiedAt: account.emailVerifiedAt ?? null,
      })),
      sessions: (stored.sessions ?? []).filter(
        (session) => Date.parse(session.expiresAt) > now,
      ),
      resetTokens: (stored.resetTokens ?? []).filter(
        (token) => token.usedAt || Date.parse(token.expiresAt) > now,
      ),
      emailVerificationTokens: stored.emailVerificationTokens ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return emptyDatabase();
    throw error;
  }
}

async function mutateDatabase<T>(
  mutator: (database: AuthDatabase) => Promise<T> | T,
) {
  let result!: T;
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const database = await readDatabase();
      result = await mutator(database);
      await mkdir(directory, { recursive: true });
      const temporary = `${databaseFile}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(database), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporary, databaseFile);
    });
  await writeQueue;
  return result;
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
  const persistent = persistentAuth();
  if (persistent) return persistent.createAccount(input);
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);
  const passwordHash = await hashPassword(input.password);
  return mutateDatabase((database) => {
    if (
      database.accounts.some(
        (account) => account.email === email || account.username === username,
      )
    )
      return { ok: false as const, reason: "duplicate" as const };
    const now = new Date().toISOString();
    const account: AuthAccount = {
      id: randomUUID(),
      name: input.name.trim().slice(0, 80),
      username,
      email,
      passwordHash,
      role: "STUDENT",
      plan: "FREE",
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    database.accounts.push(account);
    return { ok: true as const, account };
  });
}

export async function authenticateAccount(
  emailInput: string,
  password: string,
) {
  const persistent = persistentAuth();
  if (persistent) return persistent.authenticateAccount(emailInput, password);
  const database = await readDatabase();
  const account = database.accounts.find(
    (candidate) => candidate.email === normalizeEmail(emailInput),
  );
  const fallbackHash =
    "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const valid = await verifyPassword(
    password,
    account?.passwordHash ?? fallbackHash,
  );
  return valid ? (account ?? null) : null;
}

export async function createSession(accountId: string, userAgent: string) {
  const persistent = persistentAuth();
  if (persistent) return persistent.createSession(accountId, userAgent);
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const session: AuthSession = {
    id: randomUUID(),
    accountId,
    tokenHash: hashToken(token),
    userAgent,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1_000,
    ).toISOString(),
  };
  await mutateDatabase((database) => {
    database.sessions.push(session);
  });
  return { token, session };
}

export async function getSession(token: string | undefined) {
  if (!token) return null;
  const persistent = persistentAuth();
  if (persistent) return persistent.getSession(token);
  const database = await readDatabase();
  const session = database.sessions.find(
    (candidate) => candidate.tokenHash === hashToken(token),
  );
  if (!session) return null;
  const account = database.accounts.find(
    (candidate) => candidate.id === session.accountId,
  );
  return account ? { account, session } : null;
}

export async function getRequestSession(
  request: NextRequest,
  options: { allowUnverified?: boolean } = {},
) {
  const session = await getSession(request.cookies.get(SESSION_COOKIE)?.value);
  return session && (options.allowUnverified || session.account.emailVerifiedAt)
    ? session
    : null;
}

export async function revokeSession(token: string | undefined) {
  const persistent = persistentAuth();
  if (persistent) return persistent.revokeSession(token);
  if (!token) return;
  await mutateDatabase((database) => {
    database.sessions = database.sessions.filter(
      (session) => session.tokenHash !== hashToken(token),
    );
  });
}

export async function listSessions(accountId: string) {
  const persistent = persistentAuth();
  if (persistent) return persistent.listSessions(accountId);
  const database = await readDatabase();
  return database.sessions.filter((session) => session.accountId === accountId);
}

export async function revokeOtherSessions(
  accountId: string,
  currentId: string,
) {
  const persistent = persistentAuth();
  if (persistent) return persistent.revokeOtherSessions(accountId, currentId);
  await mutateDatabase((database) => {
    database.sessions = database.sessions.filter(
      (session) => session.accountId !== accountId || session.id === currentId,
    );
  });
}

export async function createPasswordReset(emailInput: string) {
  const persistent = persistentAuth();
  if (persistent) return persistent.createPasswordReset(emailInput);
  const database = await readDatabase();
  const account = database.accounts.find(
    (candidate) => candidate.email === normalizeEmail(emailInput),
  );
  if (!account) return null;
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await mutateDatabase((current) => {
    current.resetTokens = current.resetTokens.filter(
      (item) => item.accountId !== account.id,
    );
    current.resetTokens.push({
      id: randomUUID(),
      accountId: account.id,
      tokenHash: hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + RESET_MINUTES * 60 * 1_000,
      ).toISOString(),
      usedAt: null,
    });
  });
  return token;
}

export async function resetPassword(token: string, password: string) {
  const persistent = persistentAuth();
  if (persistent) return persistent.resetPassword(token, password);
  const newHash = await hashPassword(password);
  return mutateDatabase((database) => {
    const reset = database.resetTokens.find(
      (candidate) =>
        candidate.tokenHash === hashToken(token) &&
        !candidate.usedAt &&
        Date.parse(candidate.expiresAt) > Date.now(),
    );
    if (!reset) return false;
    const account = database.accounts.find(
      (candidate) => candidate.id === reset.accountId,
    );
    if (!account) return false;
    const now = new Date().toISOString();
    account.passwordHash = newHash;
    account.updatedAt = now;
    reset.usedAt = now;
    database.sessions = database.sessions.filter(
      (session) => session.accountId !== account.id,
    );
    return true;
  });
}

export async function changePassword(
  accountId: string,
  currentPassword: string,
  nextPassword: string,
) {
  const persistent = persistentAuth();
  if (persistent)
    return persistent.changePassword(accountId, currentPassword, nextPassword);
  const database = await readDatabase();
  const account = database.accounts.find(
    (candidate) => candidate.id === accountId,
  );
  if (
    !account ||
    !(await verifyPassword(currentPassword, account.passwordHash))
  )
    return false;
  const passwordHash = await hashPassword(nextPassword);
  await mutateDatabase((current) => {
    const stored = current.accounts.find(
      (candidate) => candidate.id === accountId,
    );
    if (stored) {
      stored.passwordHash = passwordHash;
      stored.updatedAt = new Date().toISOString();
    }
  });
  return true;
}

export async function changeEmail(
  accountId: string,
  emailInput: string,
  currentPassword: string,
) {
  const persistent = persistentAuth();
  if (persistent)
    return persistent.changeEmail(accountId, emailInput, currentPassword);
  const email = normalizeEmail(emailInput);
  const current = await readDatabase();
  const currentAccount = current.accounts.find((item) => item.id === accountId);
  if (
    !currentAccount ||
    !(await verifyPassword(currentPassword, currentAccount.passwordHash))
  )
    return false;
  return mutateDatabase((database) => {
    if (
      database.accounts.some(
        (item) => item.email === email && item.id !== accountId,
      )
    )
      return false;
    const account = database.accounts.find((item) => item.id === accountId);
    if (!account) return false;
    account.email = email;
    account.emailVerifiedAt = null;
    for (const token of database.emailVerificationTokens)
      if (token.accountId === accountId && !token.usedAt)
        token.expiresAt = new Date().toISOString();
    account.updatedAt = new Date().toISOString();
    return true;
  });
}

export async function createEmailVerification(
  accountId: string,
  enforceCooldown = false,
  expectedEmail?: string,
) {
  const persistent = persistentAuth();
  if (persistent)
    return persistent.createEmailVerification(
      accountId,
      enforceCooldown,
      expectedEmail,
    );
  return mutateDatabase((database) => {
    const account = database.accounts.find((item) => item.id === accountId);
    if (
      !account ||
      (expectedEmail && account.email !== expectedEmail) ||
      account.emailVerifiedAt
    )
      return null;
    const now = Date.now();
    const previous = database.emailVerificationTokens.filter(
      (item) => item.accountId === accountId,
    );
    if (enforceCooldown) {
      const recent = previous.filter(
        (item) => Date.parse(item.createdAt) > now - 3600_000,
      );
      const latest = Math.max(
        0,
        ...previous.map((item) => Date.parse(item.createdAt)),
      );
      if (now - latest < 60_000)
        throw new VerificationRateError(
          Math.ceil((60_000 - now + latest) / 1000),
        );
      if (recent.length >= 5) throw new VerificationRateError(3600);
    }
    for (const item of previous)
      if (!item.usedAt) item.expiresAt = new Date(now).toISOString();
    const token = randomBytes(32).toString("base64url");
    database.emailVerificationTokens.push({
      id: randomUUID(),
      accountId,
      tokenHash: hashToken(token),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(
        now + EMAIL_VERIFICATION_HOURS * 3600_000,
      ).toISOString(),
      usedAt: null,
    });
    return token;
  });
}

export async function verifyEmail(
  token: string,
): Promise<EmailVerificationResult> {
  const persistent = persistentAuth();
  if (persistent) return persistent.verifyEmail(token);
  return mutateDatabase((database) => {
    const stored = database.emailVerificationTokens.find(
      (item) => item.tokenHash === hashToken(token),
    );
    if (!stored) return "invalid";
    const account = database.accounts.find(
      (item) => item.id === stored.accountId,
    );
    if (!account) return "invalid";
    const status = verificationStatus(stored, Boolean(account.emailVerifiedAt));
    if (status !== "verified") return status;
    const now = new Date().toISOString();
    account.emailVerifiedAt = now;
    account.updatedAt = now;
    stored.usedAt = now;
    return "verified";
  });
}

export async function exportAccount(accountId: string) {
  const persistent = persistentAuth();
  if (persistent) return persistent.exportAccount(accountId);
  const database = await readDatabase();
  const account = database.accounts.find((item) => item.id === accountId);
  if (!account) return null;
  return {
    account: {
      id: account.id,
      name: account.name,
      username: account.username,
      email: account.email,
      role: account.role,
      plan: account.plan,
      emailVerifiedAt: account.emailVerifiedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    },
    sessions: database.sessions
      .filter((session) => session.accountId === accountId)
      .map((session) => ({
        id: session.id,
        accountId: session.accountId,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
      })),
    exportedAt: new Date().toISOString(),
  };
}

export async function deleteAccount(accountId: string) {
  const persistent = persistentAuth();
  if (persistent) return persistent.deleteAccount(accountId);
  return mutateDatabase((database) => {
    const exists = database.accounts.some(
      (account) => account.id === accountId,
    );
    database.accounts = database.accounts.filter(
      (account) => account.id !== accountId,
    );
    database.sessions = database.sessions.filter(
      (session) => session.accountId !== accountId,
    );
    database.resetTokens = database.resetTokens.filter(
      (token) => token.accountId !== accountId,
    );
    database.emailVerificationTokens = database.emailVerificationTokens.filter(
      (token) => token.accountId !== accountId,
    );
    return exists;
  });
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
  const persistent = persistentAuth();
  if (persistent) return persistent.updateOnboarding(accountId, input);
  return mutateDatabase((database) => {
    const account = database.accounts.find((item) => item.id === accountId);
    if (!account) return null;
    account.onboardingCompleted = true;
    account.locale = input.locale;
    account.initialLanguage = input.initialLanguage;
    account.updatedAt = new Date().toISOString();
    return { ...input, onboardingCompleted: true };
  });
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
  const persistent = persistentAuth();
  if (persistent) return persistent.updateProfile(accountId, input);
  return mutateDatabase((database) => {
    const account = database.accounts.find((item) => item.id === accountId);
    if (!account) return null;
    account.name = input.name;
    account.updatedAt = new Date().toISOString();
    return input;
  });
}

export function publicAccount(account: AuthAccount) {
  return {
    id: account.id,
    name: account.name,
    username: account.username,
    email: account.email,
    role: account.role,
    plan: account.plan,
    emailVerifiedAt: account.emailVerifiedAt,
    onboardingCompleted: account.onboardingCompleted ?? false,
    locale: account.locale ?? "pt-BR",
    initialLanguage: account.initialLanguage ?? "javascript",
    subscriptionStatus: account.subscriptionStatus ?? "FREE",
    currentPeriodEnd: account.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd ?? false,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function authMode() {
  if (isProductionLike()) return "required" as const;
  if (process.env.AUTH_MODE === "demo" && allowsLocalDevelopmentFeatures())
    return "demo" as const;
  if (process.env.AUTH_MODE === "required") return "required" as const;
  return "required" as const;
}

export function getDevelopmentPrincipal() {
  if (authMode() !== "demo") return null;
  const administrator = isAutomatedTestHarness();
  return {
    account: {
      id: administrator ? "e2e-admin" : "local-demo",
      name: administrator ? "Administrador de teste" : "Aluno demonstrativo",
      email: administrator ? "admin-e2e@logiclab.invalid" : "aluno@demo.dev",
      role: administrator ? ("ADMIN" as const) : ("STUDENT" as const),
      plan: "FREE" as const,
    },
    session: { id: administrator ? "e2e-admin" : "local-demo" },
    demo: true as const,
  };
}

export async function requireRole(
  request: NextRequest,
  role: AccountRole = "STUDENT",
) {
  const authenticated = await getRequestSession(request, {
    allowUnverified: true,
  });
  if (authenticated) {
    if (!authenticated.account.emailVerifiedAt) return null;
    if (role === "ADMIN" && authenticated.account.role !== "ADMIN") return null;
    return { ...authenticated, demo: false as const };
  }
  if (authMode() === "demo") {
    const principal = getDevelopmentPrincipal();
    if (!principal || (role === "ADMIN" && principal.account.role !== "ADMIN"))
      return null;
    return principal;
  }
  return null;
}
