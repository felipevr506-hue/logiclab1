import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/services/auth/auth-store";
import {
  billingService,
  BillingNotConfiguredError,
  InvalidBillingWebhookError,
} from "@/services/payments/billing-service";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
  readJsonBody,
} from "@/services/security/request-guard";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json({ error: "Solicitação recusada." }, { status: 403 });
  const authenticated = await getRequestSession(request);
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const rate = consumeRateLimit(
    `checkout:${authenticated.account.id}:${getClientAddress(request)}`,
    8,
    15 * 60_000,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Muitas tentativas de checkout. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  const parsed = await readJsonBody<{ planId?: string }>(request, 2_000);
  if (!parsed.ok)
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const idempotencyKey =
    request.headers.get("idempotency-key")?.trim() || randomUUID();
  try {
    const checkout = await billingService.startCheckout({
      userId: authenticated.account.id,
      planId: parsed.value.planId ?? "",
      idempotencyKey,
    });
    return NextResponse.json(checkout, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError)
      return NextResponse.json(
        { error: "Checkout ainda não está configurado neste ambiente." },
        { status: 503 },
      );
    if (error instanceof InvalidBillingWebhookError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(
      { error: "Não foi possível abrir o checkout agora." },
      { status: 502 },
    );
  }
}
