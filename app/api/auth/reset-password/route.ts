import { NextRequest, NextResponse } from "next/server";
import {
  getRequestSession,
  resetPassword,
  validatePassword,
} from "@/services/auth/auth-store";
import { clearSessionCookie } from "@/services/auth/http";
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
  const rate = consumeRateLimit(
    `reset:${getClientAddress(request)}`,
    8,
    30 * 60 * 1_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Tente novamente mais tarde." },
      { status: 429 },
    );
  let body: {
    token?: string;
    password?: string;
    passwordConfirmation?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (
    !body ||
    typeof body.token !== "string" ||
    !/^[a-zA-Z0-9_-]{32,128}$/.test(body.token) ||
    typeof body.password !== "string" ||
    body.password !== body.passwordConfirmation
  )
    return NextResponse.json(
      { error: "Revise o link e a confirmação da senha." },
      { status: 400 },
    );
  const passwordError = validatePassword(body.password ?? "");
  if (!body.token || passwordError)
    return NextResponse.json(
      { error: passwordError ?? "Link inválido ou expirado." },
      { status: 400 },
    );
  if (!(await resetPassword(body.token, body.password!)))
    return NextResponse.json(
      { error: "Link inválido, expirado ou já utilizado." },
      { status: 400 },
    );
  const response = NextResponse.json({ ok: true });
  // Resetting account A must not clear a valid session belonging to account B.
  return (await getRequestSession(request, { allowUnverified: true }))
    ? response
    : clearSessionCookie(response);
}
