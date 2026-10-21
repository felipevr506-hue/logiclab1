import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/services/auth/auth-store";
import {
  isTrustedMutation,
  readJsonBody,
  consumeRateLimit,
} from "@/services/security/request-guard";
import {
  AttemptError,
  claimOfficialReward,
} from "@/services/attempts/attempt-store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const session = await getRequestSession(request);
  if (!session)
    return NextResponse.json(
      { error: "Entre e confirme seu e-mail." },
      { status: 401 },
    );
  const rate = consumeRateLimit(
    `reward-claim:${session.account.id}`,
    60,
    60_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Aguarde para tentar novamente." },
      { status: 429 },
    );
  const parsed = await readJsonBody<{ projectId?: string }>(request, 1000);
  if (!parsed.ok)
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  const value = parsed.value;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== "projectId") ||
    (value.projectId !== undefined &&
      (typeof value.projectId !== "string" || value.projectId.length > 100))
  )
    return NextResponse.json(
      { error: "Solicitação inválida." },
      { status: 400 },
    );
  try {
    const official = await claimOfficialReward(
      { userId: session.account.id, sessionId: session.session.id },
      value.projectId,
    );
    return NextResponse.json(
      { official },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    if (error instanceof AttemptError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "A recompensa não foi registrada. Tente novamente." },
      { status: 503 },
    );
  }
}
