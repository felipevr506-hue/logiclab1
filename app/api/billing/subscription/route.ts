import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/services/auth/auth-store";
import {
  billingService,
  BillingNotConfiguredError,
  InvalidBillingWebhookError,
} from "@/services/payments/billing-service";
import { isTrustedMutation } from "@/services/security/request-guard";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authenticated = await getRequestSession(request);
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const subscription = await billingService.getSubscription(
    authenticated.account.id,
  );
  return NextResponse.json(
    {
      subscription: subscription ?? {
        userId: authenticated.account.id,
        provider: null,
        providerCustomerId: null,
        providerSubscriptionId: null,
        planId: "free",
        status: "FREE",
        cancelAtPeriodEnd: false,
      },
    },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json({ error: "Solicitação recusada." }, { status: 403 });
  const authenticated = await getRequestSession(request);
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const subscription = await billingService.cancel(authenticated.account.id);
    return NextResponse.json({ subscription });
  } catch (error) {
    if (error instanceof BillingNotConfiguredError)
      return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof InvalidBillingWebhookError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(
      { error: "Não foi possível cancelar a assinatura agora." },
      { status: 502 },
    );
  }
}
