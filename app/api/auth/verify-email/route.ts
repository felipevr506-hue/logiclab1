import { NextRequest, NextResponse } from "next/server";
import { verifyEmail } from "@/services/auth/auth-store";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
  readJsonBody,
} from "@/services/security/request-guard";

export const runtime = "nodejs";

// Merely opening a link (including a mail scanner) does not consume the token.
export async function GET(request: NextRequest) {
  const destination = new URL("/verificar-email", request.url);
  destination.searchParams.set(
    "token",
    (request.nextUrl.searchParams.get("token") ?? "").slice(0, 128),
  );
  return NextResponse.redirect(destination, {
    status: 303,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const rate = consumeRateLimit(
    `verify-email:${getClientAddress(request)}`,
    20,
    3600_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Tente novamente mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  const body = await readJsonBody<{ token?: unknown }>(request, 1000);
  if (!body.ok)
    return NextResponse.json({ error: body.error }, { status: body.status });
  const token = body.value?.token;
  const result =
    typeof token === "string" && /^[a-zA-Z0-9_-]{32,128}$/.test(token)
      ? await verifyEmail(token)
      : "invalid";
  return NextResponse.json(
    { status: result },
    {
      status: ["verified", "already_verified"].includes(result) ? 200 : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
