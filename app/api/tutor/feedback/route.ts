import { NextRequest, NextResponse } from "next/server";
import { recordTutorFeedback } from "@/services/ai/usage-store";
import { requireRole } from "@/services/auth/auth-store";
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
  if (!(await requireRole(request)))
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const rate = consumeRateLimit(
    `tutor-feedback:${getClientAddress(request)}`,
    40,
    60 * 60 * 1_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Limite de feedback atingido." },
      { status: 429 },
    );
  const body = (await request.json()) as {
    messageId?: string;
    exerciseId?: string;
    helpful?: boolean;
    comment?: string;
  };
  if (!body.messageId || typeof body.helpful !== "boolean")
    return NextResponse.json({ error: "Feedback inválido." }, { status: 400 });
  await recordTutorFeedback({
    messageId: body.messageId.slice(0, 120),
    exerciseId: String(body.exerciseId ?? "unknown").slice(0, 100),
    helpful: body.helpful,
    comment: body.comment?.trim().slice(0, 500),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
