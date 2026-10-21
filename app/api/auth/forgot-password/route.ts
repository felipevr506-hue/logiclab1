import { NextRequest, NextResponse } from "next/server";
import { createPasswordReset } from "@/services/auth/auth-store";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
} from "@/services/security/request-guard";
import {
  publicEmailDelivery,
  sendAuthEmail,
} from "@/services/email/auth-email";

export const runtime = "nodejs";

const genericMessage =
  "Se houver uma conta para este e-mail, as instruções serão enviadas.";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json({ message: genericMessage }, { status: 202 });
  const rate = consumeRateLimit(
    `forgot:${getClientAddress(request)}`,
    5,
    30 * 60 * 1_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { message: genericMessage },
      {
        status: 202,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  let email = "";
  try {
    email = String(((await request.json()) as { email?: string }).email ?? "");
  } catch {}
  email = email.trim().toLowerCase();
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))
    return NextResponse.json({ message: genericMessage }, { status: 202 });
  const token = await createPasswordReset(email);
  const delivery = token
    ? publicEmailDelivery(
        await sendAuthEmail({ to: email, kind: "reset", token }),
        request.nextUrl.hostname,
      )
    : null;
  // Anonymous callers receive the same production response for missing accounts and delivery failures.
  return NextResponse.json(
    {
      message: genericMessage,
      ...(delivery?.localUrl
        ? { localResetUrl: delivery.localUrl, developmentOnly: true }
        : {}),
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
