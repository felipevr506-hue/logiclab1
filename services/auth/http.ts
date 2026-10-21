import "server-only";

import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/services/auth/auth-store";
import { isProductionLike } from "@/services/security/environment";

export function sessionCookieOptions(expiresAt?: string) {
  const applicationUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProductionLike() || applicationUrl.startsWith("https://"),
    path: "/",
    ...(expiresAt ? { expires: new Date(expiresAt) } : {}),
  };
}

export function withSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: string,
) {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde um pouco e tente novamente." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export function forbiddenMutation() {
  return NextResponse.json(
    { error: "A origem desta solicitação não foi aceita." },
    { status: 403 },
  );
}
