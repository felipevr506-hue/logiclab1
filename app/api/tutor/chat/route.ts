import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/services/auth/auth-store";
import {
  consumeRateLimit,
  isTrustedMutation,
} from "@/services/security/request-guard";
import {
  ChatError,
  parseChatInput,
  readChat,
  sendChat,
} from "@/services/ai/chat-store";
import { tutorConfiguration } from "@/services/ai/chat-provider";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
async function boundedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError("Dados inválidos.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 48_000) {
        await reader.cancel();
        throw new ChatError("Solicitação muito grande.", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError("JSON inválido.");
  }
}
async function identity(request: NextRequest) {
  const s = await getRequestSession(request);
  if (!s || s.account.id === "local-demo")
    throw new ChatError("Entre em uma conta real e confirme seu e-mail.", 401);
  return s;
}
function failure(error: unknown) {
  if (!(error instanceof ChatError))
    console.error("Tutor request failed", {
      name: error instanceof Error ? error.name : "unknown",
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "unknown",
    });
  return error instanceof ChatError
    ? NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            ...headers,
            ...(error.retryAfter
              ? { "Retry-After": String(error.retryAfter) }
              : {}),
          },
        },
      )
    : NextResponse.json(
        { error: "Tutor temporariamente indisponível." },
        { status: 503, headers },
      );
}
export async function GET(request: NextRequest) {
  try {
    const session = await identity(request);
    if (
      [...request.nextUrl.searchParams.keys()].some((k) => k !== "exerciseId")
    )
      throw new ChatError("A identidade é determinada pela sessão.");
    const exerciseId = request.nextUrl.searchParams.get("exerciseId") ?? "";
    const { available, mode } = tutorConfiguration();
    return NextResponse.json(
      {
        messages: await readChat(session.account.id, exerciseId),
        available,
        mode,
      },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    if (!isTrustedMutation(request))
      throw new ChatError("Solicitação recusada.", 403);
    const session = await identity(request);
    const rate = consumeRateLimit(
      `tutor-chat-burst:${session.account.id}`,
      8,
      60_000,
    );
    if (!rate.allowed)
      throw new ChatError(
        "Muitas mensagens. Aguarde um minuto.",
        429,
        rate.retryAfterSeconds,
      );
    const input = parseChatInput(await boundedBody(request));
    return NextResponse.json(
      await sendChat(
        { userId: session.account.id, sessionId: session.session.id },
        input,
        request.signal,
      ),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
