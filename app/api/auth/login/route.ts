import { after, NextRequest, NextResponse } from "next/server";
import {
  authenticateAccount,
  createSession,
  publicAccount,
} from "@/services/auth/auth-store";
import { withSessionCookie } from "@/services/auth/http";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
  safeUserAgent,
} from "@/services/security/request-guard";
import {
  privacySafeIdentifier,
  recordSecurityEvent,
} from "@/services/security/event-store";
import { recordProductEvent } from "@/services/analytics/product-events";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const address = getClientAddress(request);
  const rate = consumeRateLimit(`login:${address}`, 10, 15 * 60 * 1_000);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde antes de tentar novamente." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    body.email.length > 254 ||
    body.password.length > 128
  )
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const account = await authenticateAccount(
    body.email ?? "",
    body.password ?? "",
  );
  if (!account)
    await recordSecurityEvent({
      type: "auth.login",
      outcome: "failure",
      targetHash: privacySafeIdentifier(body.email ?? ""),
      address,
    });
  if (!account)
    return NextResponse.json(
      {
        error:
          "Não foi possível entrar. Verifique seus dados e tente novamente.",
      },
      { status: 401 },
    );
  const { token, session } = await createSession(
    account.id,
    safeUserAgent(request),
  );
  await recordSecurityEvent({
    type: "auth.login",
    outcome: "success",
    actorId: account.id,
    targetHash: privacySafeIdentifier(account.email),
    address,
  });
  after(() =>
    recordProductEvent({
      userId: account.id,
      name: "login_success",
      sessionId: session.id,
    }).catch(() => undefined),
  );
  return withSessionCookie(
    NextResponse.json({
      account: publicAccount(account),
      verificationRequired: !account.emailVerifiedAt,
    }),
    token,
    session.expiresAt,
  );
}
