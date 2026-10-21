import { NextRequest, NextResponse } from "next/server";
import { recordTutorUsage } from "@/services/ai/usage-store";
import { requireRole } from "@/services/auth/auth-store";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
} from "@/services/security/request-guard";
import { getPlanLimits } from "@/services/entitlements/entitlements";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const authenticated = await requireRole(request);
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const plan = authenticated.account.plan === "PRO" ? "pro" : "free";
  const rate = consumeRateLimit(
    `tutor:${authenticated.account.id}:${getClientAddress(request)}`,
    getPlanLimits(plan).tutorRequestsPerDay,
    24 * 60 * 60 * 1_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Limite diário do Tutor atingido." },
      { status: 429 },
    );
  const body = (await request.json()) as {
    exerciseId?: string;
    requestType?: string;
    durationMs?: number;
    success?: boolean;
    promptVersion?: string;
  };
  await recordTutorUsage({
    exerciseId: String(body.exerciseId ?? "unknown").slice(0, 100),
    requestType: String(body.requestType ?? "unknown").slice(0, 60),
    model: "socratic-local",
    promptVersion: String(body.promptVersion ?? "unknown").slice(0, 60),
    durationMs: Math.max(0, Math.min(120_000, Number(body.durationMs) || 0)),
    success: body.success !== false,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostMicros: 0,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
