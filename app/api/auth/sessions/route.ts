import { NextRequest, NextResponse } from "next/server";
import {
  getRequestSession,
  listSessions,
  revokeOtherSessions,
} from "@/services/auth/auth-store";
import {
  describeDevice,
  isTrustedMutation,
} from "@/services/security/request-guard";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authenticated = await getRequestSession(request, {
    allowUnverified: true,
  });
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const sessions = await listSessions(authenticated.account.id);
  return NextResponse.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      device: describeDevice(session.userAgent),
      current: session.id === authenticated.session.id,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
    })),
  });
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const authenticated = await getRequestSession(request, {
    allowUnverified: true,
  });
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  await revokeOtherSessions(authenticated.account.id, authenticated.session.id);
  return NextResponse.json({ ok: true });
}
