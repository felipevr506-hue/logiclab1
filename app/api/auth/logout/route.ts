import { NextRequest, NextResponse } from "next/server";
import { revokeSession, SESSION_COOKIE } from "@/services/auth/auth-store";
import { clearSessionCookie } from "@/services/auth/http";
import { isTrustedMutation } from "@/services/security/request-guard";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
