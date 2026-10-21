import { NextRequest, NextResponse } from "next/server";
import {
  billingService,
  BillingNotConfiguredError,
  InvalidBillingWebhookError,
} from "@/services/payments/billing-service";
import { consumeRateLimit, getClientAddress } from "@/services/security/request-guard";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rate = consumeRateLimit(
    `billing-webhook:${getClientAddress(request)}`,
    240,
    60_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Limite temporário atingido." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > 1_000_000)
    return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
  const payload = await request.text();
  if (!payload || payload.length > 1_000_000)
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  try {
    const event = await billingService.processWebhook(payload, request.headers);
    return NextResponse.json({ received: true, event });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError)
      return NextResponse.json({ error: "Billing indisponível." }, { status: 503 });
    if (error instanceof InvalidBillingWebhookError)
      return NextResponse.json({ error: "Webhook inválido." }, { status: 401 });
    return NextResponse.json(
      { error: "Não foi possível processar o evento." },
      { status: 500 },
    );
  }
}
