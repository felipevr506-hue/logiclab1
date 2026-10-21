import { NextRequest, NextResponse } from "next/server";
import { databasePersistenceMode } from "@/services/persistence/database";
import { readOfficialProgress } from "@/services/attempts/attempt-store";
import { applyOfficialProgress } from "@/lib/trusted-progress";
import type { AppState } from "@/lib/types";

async function withOfficialSnapshot<T extends { state: unknown }>(
  snapshot: T | null,
  userId?: string,
): Promise<T | null> {
  if (!snapshot || !userId) return snapshot;
  const value = snapshot.state as AppState;
  if (!value?.user) return snapshot;
  const official =
    databasePersistenceMode() === "postgres"
      ? await readOfficialProgress(userId)
      : null;
  return {
    ...snapshot,
    state: applyOfficialProgress(
      { ...value, user: { ...value.user, accountId: userId } },
      official,
    ),
  };
}
import {
  readStoredProgress,
  writeStoredProgress,
} from "@/services/sync/progress-store";
import {
  authMode,
  getDevelopmentPrincipal,
  getRequestSession,
} from "@/services/auth/auth-store";
import {
  InvalidProgressError,
  sanitizeProgressBackup,
} from "@/services/sync/progress-policy";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
} from "@/services/security/request-guard";

export const runtime = "nodejs";

function validAccount(value: string) {
  return value.length >= 3 && value.length <= 180 && value.includes("@");
}

async function progressAccess(request: NextRequest, account: string) {
  const authenticated = await getRequestSession(request);
  if (authenticated) {
    if (authenticated.account.email !== account) return null;
    return {
      storageKey: `user:${authenticated.account.id}`,
      authenticated,
      demo: false as const,
    };
  }
  const development = getDevelopmentPrincipal();
  if (authMode() === "required" || account !== development?.account.email)
    return null;
  return {
    storageKey: `demo:${account}`,
    authenticated: null,
    demo: true as const,
  };
}

export async function GET(request: NextRequest) {
  const account = request.nextUrl.searchParams.get("account")?.trim() ?? "";
  if (!validAccount(account))
    return NextResponse.json({ error: "Conta inválida." }, { status: 400 });
  const normalizedAccount = account.toLowerCase();
  const access = await progressAccess(request, normalizedAccount);
  if (!access)
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const ownerId =
    access.authenticated?.account.id ?? getDevelopmentPrincipal()!.account.id;
  if (
    request.nextUrl.searchParams.get("ownerId") &&
    request.nextUrl.searchParams.get("ownerId") !== ownerId
  )
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const snapshot = await readStoredProgress(access.storageKey);
  return NextResponse.json(
    {
      snapshot: await withOfficialSnapshot(
        snapshot,
        access.authenticated?.account.id,
      ),
      ownerId,
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}

export async function PUT(request: NextRequest) {
  const rate = consumeRateLimit(
    `progress:${getClientAddress(request)}`,
    90,
    60_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Limite de sincronização excedido." },
      { status: 429 },
    );
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const raw = await request.text();
  if (raw.length > 2_000_000)
    return NextResponse.json(
      { error: "O backup ultrapassa o limite de 2 MB." },
      { status: 413 },
    );
  let body: {
    account?: string;
    ownerId?: string;
    baseRevision?: number;
    state?: unknown;
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const account = body.account?.trim().toLowerCase() ?? "";
  if (
    !validAccount(account) ||
    !Number.isInteger(body.baseRevision) ||
    !body.state ||
    typeof body.state !== "object"
  )
    return NextResponse.json(
      { error: "Backup incompleto ou inválido." },
      { status: 400 },
    );
  const access = await progressAccess(request, account);
  if (!access)
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const ownerId =
    access.authenticated?.account.id ?? getDevelopmentPrincipal()!.account.id;
  if (body.ownerId && body.ownerId !== ownerId)
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const state = body.state as { user?: { email?: string; accountId?: string } };
  if (state.user?.accountId && state.user.accountId !== ownerId)
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (state.user?.email?.trim().toLowerCase() !== account)
    return NextResponse.json(
      { error: "A conta não corresponde ao progresso enviado." },
      { status: 403 },
    );
  let storedState = body.state;
  if (access.authenticated) {
    const current = await readStoredProgress(access.storageKey);
    const currentState = current?.state as
      | { user?: { trainingStartedOn?: string } }
      | undefined;
    try {
      storedState = await sanitizeProgressBackup(
        body.state,
        access.authenticated.account,
        currentState?.user?.trainingStartedOn,
      );
    } catch (error) {
      if (error instanceof InvalidProgressError)
        return NextResponse.json({ error: error.message }, { status: 400 });
      throw error;
    }
  }
  storedState = {
    ...(storedState as object),
    user: { ...(storedState as { user: object }).user, accountId: ownerId },
  };
  const result = await writeStoredProgress(
    access.storageKey,
    body.baseRevision as number,
    storedState,
    account,
  );
  return NextResponse.json(
    {
      snapshot: await withOfficialSnapshot(
        result.snapshot,
        access.authenticated?.account.id,
      ),
      conflict: !result.ok,
      ownerId,
    },
    {
      status: result.ok ? 200 : 409,
      headers: { "Cache-Control": "no-store, private" },
    },
  );
}
