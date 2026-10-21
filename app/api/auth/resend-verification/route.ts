import { NextRequest, NextResponse } from "next/server";
import {
  createEmailVerification,
  getRequestSession,
} from "@/services/auth/auth-store";
import { VerificationRateError } from "@/services/auth/verification-policy";
import {
  publicEmailDelivery,
  sendAuthEmail,
} from "@/services/email/auth-email";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
} from "@/services/security/request-guard";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const session = await getRequestSession(request, { allowUnverified: true });
  if (!session)
    return NextResponse.json(
      { error: "Entre novamente para reenviar a confirmação." },
      { status: 401 },
    );
  if (session.account.emailVerifiedAt)
    return NextResponse.json({ status: "already_verified" });
  const rate = consumeRateLimit(
    `verification-resend:${getClientAddress(request)}`,
    10,
    3600_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Aguarde antes de reenviar." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  try {
    const token = await createEmailVerification(
      session.account.id,
      true,
      session.account.email,
    );
    if (!token) return NextResponse.json({ status: "already_verified" });
    const delivery = publicEmailDelivery(
      await sendAuthEmail({ to: session.account.email, kind: "verify", token }),
      request.nextUrl.hostname,
    );
    return NextResponse.json(
      { delivery },
      {
        status: delivery.status === "failed" ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error instanceof VerificationRateError)
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        },
      );
    throw error;
  }
}
