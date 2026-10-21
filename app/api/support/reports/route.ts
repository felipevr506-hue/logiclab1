import { NextRequest, NextResponse } from "next/server";
import { createSupportTicket } from "@/services/support/report-store";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
  safeUserAgent,
} from "@/services/security/request-guard";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const rate = consumeRateLimit(
    `support:${getClientAddress(request)}`,
    8,
    60 * 60 * 1_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Limite de reports atingido. Tente novamente mais tarde." },
      { status: 429 },
    );
  const raw = await request.text();
  if (raw.length > 12_000)
    return NextResponse.json(
      { error: "Report muito grande." },
      { status: 413 },
    );
  let body: {
    category?: string;
    summary?: string;
    page?: string;
    exerciseId?: string;
    language?: string;
    errorType?: string;
    executionId?: string;
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const summary = body.summary?.trim() ?? "";
  if (summary.length < 10 || summary.length > 2_000)
    return NextResponse.json(
      { error: "Descreva o problema em 10 a 2.000 caracteres." },
      { status: 400 },
    );
  const ticket = await createSupportTicket({
    category: (body.category ?? "technical").slice(0, 60),
    summary,
    page: (body.page ?? "").slice(0, 300),
    exerciseId: body.exerciseId?.slice(0, 100),
    language: body.language?.slice(0, 40),
    browser: safeUserAgent(request),
    errorType: body.errorType?.slice(0, 80),
    executionId: body.executionId?.slice(0, 120),
  });
  return NextResponse.json(
    { id: ticket.id, status: ticket.status },
    { status: 201 },
  );
}
