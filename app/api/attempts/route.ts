import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/services/auth/auth-store";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
  readJsonBody,
} from "@/services/security/request-guard";
import {
  AttemptError,
  parseSubmission,
  readOfficialProgress,
  submitAttempt,
} from "@/services/attempts/attempt-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session)
    return NextResponse.json(
      { error: "Entre e confirme seu e-mail." },
      { status: 401, headers },
    );
  if ([...request.nextUrl.searchParams.keys()].length)
    return NextResponse.json(
      { error: "O proprietário é determinado pela sessão." },
      { status: 400, headers },
    );
  try {
    return NextResponse.json(
      { official: await readOfficialProgress(session.account.id) },
      { headers },
    );
  } catch (error) {
    if (error instanceof AttemptError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers },
      );
    throw error;
  }
}
export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403, headers },
    );
  const session = await getRequestSession(request);
  if (!session)
    return NextResponse.json(
      { error: "Entre e confirme seu e-mail." },
      { status: 401, headers },
    );
  for (const key of [
    `attempt-user:${session.account.id}`,
    `attempt-ip:${getClientAddress(request)}`,
  ]) {
    const rate = consumeRateLimit(key, 120, 60_000);
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Aguarde antes de enviar outra tentativa." },
        {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": String(rate.retryAfterSeconds),
          },
        },
      );
  }
  const parsed = await readJsonBody<unknown>(request, 90_000);
  if (!parsed.ok)
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status, headers },
    );
  try {
    const result = await submitAttempt(
      { userId: session.account.id, sessionId: session.session.id },
      parseSubmission(parsed.value),
    );
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof AttemptError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers },
      );
    console.error(
      "Attempt transaction failed; no partial progress was committed.",
    );
    return NextResponse.json(
      {
        error:
          "Não foi possível registrar a tentativa. Reenvie com a mesma chave.",
      },
      { status: 503, headers },
    );
  }
}
