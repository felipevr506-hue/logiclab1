import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/services/auth/auth-store";
import {
  AttemptError,
  revealOfficialHint,
} from "@/services/attempts/attempt-store";
import {
  isTrustedMutation,
  readJsonBody,
  consumeRateLimit,
} from "@/services/security/request-guard";
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
    `official-hints:${session.account.id}`,
    90,
    60_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Aguarde antes de solicitar outra dica." },
      { status: 429 },
    );
  const parsed = await readJsonBody<{ exerciseId?: string }>(request, 1000);
  if (!parsed.ok)
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  if (
    !parsed.value ||
    Object.keys(parsed.value).some((key) => key !== "exerciseId") ||
    typeof parsed.value.exerciseId !== "string"
  )
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json(
      await revealOfficialHint(
        { userId: session.account.id, sessionId: session.session.id },
        parsed.value.exerciseId,
      ),
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    if (error instanceof AttemptError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "A dica não foi registrada. Tente novamente." },
      { status: 503 },
    );
  }
}
