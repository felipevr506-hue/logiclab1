import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAccount,
  changeEmail,
  changePassword,
  createEmailVerification,
  deleteAccount,
  exportAccount,
  getRequestSession,
  revokeOtherSessions,
  validatePassword,
} from "@/services/auth/auth-store";
import { clearSessionCookie } from "@/services/auth/http";
import { VerificationRateError } from "@/services/auth/verification-policy";
import {
  getClientAddress,
  isTrustedMutation,
  readJsonBody,
} from "@/services/security/request-guard";
import { recordSecurityEvent } from "@/services/security/event-store";
import { billingService } from "@/services/payments/billing-service";
import {
  publicEmailDelivery,
  sendAuthEmail,
} from "@/services/email/auth-email";
import {
  deleteStoredProgress,
  readStoredProgress,
} from "@/services/sync/progress-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "Use a exportaÃ§Ã£o com confirmaÃ§Ã£o de senha." },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "SolicitaÃ§Ã£o recusada." },
      { status: 403 },
    );
  const authenticated = await getRequestSession(request, {
    allowUnverified: true,
  });
  if (!authenticated)
    return NextResponse.json({ error: "NÃ£o autenticado." }, { status: 401 });
  const parsed = await readJsonBody<{ action?: string; password?: string }>(
    request,
    2_000,
  );
  if (!parsed.ok)
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  if (parsed.value.action !== "export")
    return NextResponse.json({ error: "AÃ§Ã£o invÃ¡lida." }, { status: 400 });
  if (
    !(await authenticateAccount(
      authenticated.account.email,
      parsed.value.password ?? "",
    ))
  )
    return NextResponse.json(
      { error: "Confirme sua senha atual para exportar os dados." },
      { status: 401 },
    );
  const exported = await exportAccount(authenticated.account.id);
  const progress = await readStoredProgress(`user:${authenticated.account.id}`);
  await recordSecurityEvent({
    type: "account.export",
    outcome: "success",
    actorId: authenticated.account.id,
    address: getClientAddress(request),
  });
  return NextResponse.json(
    { ...exported, progress },
    {
      headers: {
        "Content-Disposition": 'attachment; filename="logiclab-dados.json"',
        "Cache-Control": "no-store, private",
      },
    },
  );
}

export async function PATCH(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "SolicitaÃ§Ã£o recusada." },
      { status: 403 },
    );
  const authenticated = await getRequestSession(request, {
    allowUnverified: true,
  });
  if (!authenticated)
    return NextResponse.json({ error: "NÃ£o autenticado." }, { status: 401 });
  type PatchBody =
    | { action?: "password"; currentPassword?: string; password?: string }
    | { action?: "email"; email?: string; currentPassword?: string };
  const parsed = await readJsonBody<PatchBody>(request, 4_000);
  if (!parsed.ok)
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  const body = parsed.value;

  if (body.action === "password") {
    const passwordError = validatePassword(body.password ?? "");
    if (passwordError)
      return NextResponse.json({ error: passwordError }, { status: 400 });
    const changed = await changePassword(
      authenticated.account.id,
      body.currentPassword ?? "",
      body.password ?? "",
    );
    if (!changed)
      return NextResponse.json(
        { error: "Senha atual incorreta." },
        { status: 400 },
      );
    await revokeOtherSessions(
      authenticated.account.id,
      authenticated.session.id,
    );
    await recordSecurityEvent({
      type: "account.password-change",
      outcome: "success",
      actorId: authenticated.account.id,
      address: getClientAddress(request),
    });
    return NextResponse.json({ ok: true });
  }

  if (
    body.action === "email" &&
    body.email &&
    /^\S+@\S+\.\S+$/.test(body.email)
  ) {
    const changed = await changeEmail(
      authenticated.account.id,
      body.email,
      body.currentPassword ?? "",
    );
    if (!changed)
      return NextResponse.json(
        { error: "Senha incorreta ou e-mail indisponÃ­vel." },
        { status: 409 },
      );
    const changedEmail = body.email.trim().toLowerCase();
    let token: string | null = null;
    let retryAfterSeconds: number | undefined;
    try {
      token = await createEmailVerification(
        authenticated.account.id,
        true,
        changedEmail,
      );
    } catch (error) {
      if (!(error instanceof VerificationRateError)) throw error;
      retryAfterSeconds = error.retryAfterSeconds;
    }
    const delivery = token
      ? publicEmailDelivery(
          await sendAuthEmail({ to: changedEmail, kind: "verify", token }),
          request.nextUrl.hostname,
        )
      : { status: "failed" as const, delivered: false, local: false };
    await recordSecurityEvent({
      type: "account.email-change",
      outcome: "success",
      actorId: authenticated.account.id,
      address: getClientAddress(request),
    });
    return NextResponse.json({
      ok: true,
      verificationRequired: true,
      accountId: authenticated.account.id,
      delivery,
      retryAfterSeconds,
    });
  }

  return NextResponse.json({ error: "AÃ§Ã£o invÃ¡lida." }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "SolicitaÃ§Ã£o recusada." },
      { status: 403 },
    );
  const authenticated = await getRequestSession(request, {
    allowUnverified: true,
  });
  if (!authenticated)
    return NextResponse.json({ error: "NÃ£o autenticado." }, { status: 401 });
  const parsed = await readJsonBody<{
    confirmation?: string;
    password?: string;
  }>(request, 2_000);
  if (!parsed.ok)
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  if (parsed.value.confirmation !== "EXCLUIR MINHA CONTA")
    return NextResponse.json(
      { error: "Digite a confirmaÃ§Ã£o completa para excluir a conta." },
      { status: 400 },
    );
  if (
    !(await authenticateAccount(
      authenticated.account.email,
      parsed.value.password ?? "",
    ))
  )
    return NextResponse.json(
      { error: "Confirme sua senha atual para excluir a conta." },
      { status: 401 },
    );
  const subscription = await billingService.getSubscription(
    authenticated.account.id,
  );
  if (
    subscription &&
    ["ACTIVE", "PENDING", "PAST_DUE"].includes(subscription.status)
  ) {
    return NextResponse.json(
      {
        error:
          "Cancele a renovação da assinatura antes de excluir a conta. Seu progresso não será apagado pelo cancelamento.",
      },
      { status: 409 },
    );
  }
  await deleteStoredProgress(`user:${authenticated.account.id}`);
  await deleteStoredProgress(authenticated.account.email);
  await recordSecurityEvent({
    type: "account.delete",
    outcome: "success",
    actorId: authenticated.account.id,
    address: getClientAddress(request),
  });
  await deleteAccount(authenticated.account.id);
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
