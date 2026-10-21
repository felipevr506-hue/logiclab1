import { after, NextRequest, NextResponse } from "next/server";
import {
  createAccount,
  createEmailVerification,
  createSession,
  publicAccount,
  validatePassword,
} from "@/services/auth/auth-store";
import { normalizeUsername, validateUsername } from "@/lib/auth-validation";
import { withSessionCookie } from "@/services/auth/http";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
  safeUserAgent,
} from "@/services/security/request-guard";
import { isAutomatedTestHarness } from "@/services/security/environment";
import {
  privacySafeIdentifier,
  recordSecurityEvent,
} from "@/services/security/event-store";
import {
  publicEmailDelivery,
  sendAuthEmail,
} from "@/services/email/auth-email";
import { recordProductEvent } from "@/services/analytics/product-events";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/services/legal/legal-config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const rate = consumeRateLimit(
    `signup:${getClientAddress(request)}`,
    isAutomatedTestHarness() ? 100 : 12,
    15 * 60 * 1_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  let body: {
    name?: string;
    username?: string;
    passwordConfirmation?: string;
    email?: string;
    password?: string;
    acceptedTerms?: boolean;
    website?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (body?.website) return NextResponse.json({ ok: true }, { status: 202 });
  if (
    !body ||
    [
      body.name,
      body.username,
      body.email,
      body.password,
      body.passwordConfirmation,
    ].some((item) => typeof item !== "string")
  )
    return NextResponse.json(
      { error: "Preencha todos os campos do cadastro." },
      { status: 400 },
    );
  const name = body.name!.trim();
  const username = normalizeUsername(body.username!);
  const usernameError = validateUsername(username);
  if (usernameError)
    return NextResponse.json({ error: usernameError }, { status: 400 });
  if (body.password !== body.passwordConfirmation)
    return NextResponse.json(
      { error: "As senhas não coincidem." },
      { status: 400 },
    );
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const passwordError = validatePassword(password);
  if (
    name.length < 2 ||
    name.length > 80 ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    passwordError ||
    body.acceptedTerms !== true
  )
    return NextResponse.json(
      { error: passwordError ?? "Revise nome e e-mail." },
      { status: 400 },
    );
  after(() =>
    recordProductEvent({ name: "signup_started" }).catch(() => undefined),
  );
  const created = await createAccount({
    name,
    username,
    email,
    password,
    termsAcceptedAt: new Date(),
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  });
  if (!created.ok)
    return NextResponse.json(
      { error: "Não foi possível criar a conta com esses dados." },
      { status: 409 },
    );
  const { token, session } = await createSession(
    created.account.id,
    safeUserAgent(request),
  );
  const verificationToken = await createEmailVerification(
    created.account.id,
    false,
    created.account.email,
  );
  const delivery = verificationToken
    ? publicEmailDelivery(
        await sendAuthEmail({
          to: created.account.email,
          kind: "verify",
          token: verificationToken,
        }),
        request.nextUrl.hostname,
      )
    : { status: "failed" as const, delivered: false, local: false };
  await recordSecurityEvent({
    type: "auth.signup",
    outcome: "success",
    actorId: created.account.id,
    targetHash: privacySafeIdentifier(created.account.email),
    address: getClientAddress(request),
  });
  after(async () => {
    await Promise.allSettled([
      recordProductEvent({
        userId: created.account.id,
        name: "signup_completed",
        sessionId: session.id,
      }),
    ]);
  });
  const response = NextResponse.json(
    {
      account: publicAccount(created.account),
      verificationRequired: true,
      delivery,
    },
    { status: 201 },
  );
  return withSessionCookie(response, token, session.expiresAt);
}
