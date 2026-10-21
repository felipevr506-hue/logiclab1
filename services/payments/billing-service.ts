import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { recordProductEvent } from "@/services/analytics/product-events";
import { databasePersistenceMode, getPrisma } from "@/services/persistence/database";
import { getPlan } from "@/services/payments/plans";
import type {
  BillingEvent,
  BillingService,
  BillingSubscription,
  CheckoutRequest,
  CheckoutSession,
  SubscriptionStatus,
} from "@/services/payments/types";

export class BillingNotConfiguredError extends Error {
  constructor(message = "Nenhum provedor de pagamentos foi configurado.") {
    super(message);
  }
}

export class InvalidBillingWebhookError extends Error {
  constructor(message = "Webhook de pagamento inválido.") {
    super(message);
  }
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function date(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function secretMatches(received: string, expected: string) {
  const receivedHash = createHash("sha256").update(received).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

export function verifyHotmartWebhook(headers: Headers) {
  const expected =
    process.env.HOTMART_WEBHOOK_SECRET?.trim() ||
    process.env.BILLING_WEBHOOK_SECRET?.trim();
  if (!expected) throw new BillingNotConfiguredError("HOTMART_WEBHOOK_SECRET não configurado.");
  const received = headers.get("x-hotmart-hottok")?.trim() ?? "";
  return Boolean(received) && secretMatches(received, expected);
}

function providerConfigured() {
  if (process.env.BILLING_PROVIDER?.trim().toLowerCase() !== "hotmart") {
    throw new BillingNotConfiguredError();
  }
  if (databasePersistenceMode() !== "postgres") {
    throw new BillingNotConfiguredError(
      "O checkout exige PostgreSQL e DATABASE_URL configurada.",
    );
  }
}

function checkoutUrl() {
  const configured =
    process.env.HOTMART_CHECKOUT_URL?.trim() ||
    process.env.BILLING_CHECKOUT_URL?.trim();
  if (!configured)
    throw new BillingNotConfiguredError("HOTMART_CHECKOUT_URL não configurada.");
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "hotmart.com" && !url.hostname.endsWith(".hotmart.com"))
  ) {
    throw new BillingNotConfiguredError(
      "HOTMART_CHECKOUT_URL deve apontar para um domínio HTTPS oficial da Hotmart.",
    );
  }
  return url;
}

function subscriptionShape(subscription: {
  id: string;
  userId: string;
  provider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}): BillingSubscription {
  return {
    id: subscription.id,
    userId: subscription.userId,
    provider: subscription.provider,
    providerCustomerId: subscription.providerCustomerId,
    providerSubscriptionId: subscription.providerSubscriptionId,
    planId: subscription.planId,
    status: subscription.status,
    ...(subscription.currentPeriodStart
      ? { currentPeriodStart: subscription.currentPeriodStart.toISOString() }
      : {}),
    ...(subscription.currentPeriodEnd
      ? { currentPeriodEnd: subscription.currentPeriodEnd.toISOString() }
      : {}),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export function mapHotmartEventStatus(
  eventType: string,
): SubscriptionStatus | null {
  switch (eventType) {
    case "PURCHASE_APPROVED":
    case "PURCHASE_COMPLETE":
      return "ACTIVE";
    case "PURCHASE_BILLET_PRINTED":
      return "PENDING";
    case "PURCHASE_DELAYED":
    case "PURCHASE_PROTEST":
      return "PAST_DUE";
    case "PURCHASE_CANCELED":
    case "SUBSCRIPTION_CANCELLATION":
      return "CANCELED";
    case "PURCHASE_EXPIRED":
      return "EXPIRED";
    case "PURCHASE_REFUNDED":
    case "PURCHASE_CHARGEBACK":
      return "REFUNDED";
    default:
      return null;
  }
}

function eventDetails(payload: JsonObject) {
  const data = object(payload.data);
  const purchase = object(data.purchase);
  const product = object(data.product);
  const offer = object(purchase.offer);
  const origin = object(purchase.origin);
  const tracking = object(purchase.tracking);
  const subscription = object(data.subscription);
  const subscriber = object(data.subscriber);
  const subscriptionSubscriber = object(subscription.subscriber);
  const buyer = object(data.buyer);
  const sck =
    text(origin.sck) ||
    text(tracking.source_sck) ||
    text(data.sck) ||
    text(payload.sck);
  const checkoutContextId = sck.startsWith("ll_") ? sck.slice(3) : "";
  return {
    eventId: text(payload.id),
    eventType: text(payload.event).toUpperCase(),
    version: text(payload.version),
    productId: text(product.id),
    productUcode: text(product.ucode),
    offerCode: text(offer.code),
    checkoutContextId,
    transactionId: text(purchase.transaction),
    providerSubscriptionId:
      text(subscription.id) || text(subscription.code),
    providerCustomerId:
      text(subscriber.code) ||
      text(subscriptionSubscriber.code) ||
      text(subscription.subscriber_code) ||
      text(buyer.ucode),
    currentPeriodStart:
      date(purchase.approved_date) ||
      date(purchase.order_date) ||
      date(payload.creation_date),
    currentPeriodEnd:
      date(purchase.date_next_charge) || date(data.date_next_charge),
    amountInCents: Math.max(
      0,
      Math.round(Number(object(purchase.price).value ?? 0) * 100),
    ),
    currency: text(object(purchase.price).currency_code) || "BRL",
  };
}

function validateProduct(details: ReturnType<typeof eventDetails>) {
  const expectedProduct = process.env.HOTMART_PRODUCT_ID?.trim();
  if (!expectedProduct)
    throw new BillingNotConfiguredError("HOTMART_PRODUCT_ID não configurado.");
  if (
    details.productId !== expectedProduct &&
    details.productUcode !== expectedProduct
  )
    throw new InvalidBillingWebhookError("Produto do webhook não autorizado.");
  const expectedOffer = process.env.HOTMART_OFFER_CODE?.trim();
  if (
    expectedOffer &&
    details.eventType !== "SUBSCRIPTION_CANCELLATION" &&
    details.offerCode !== expectedOffer
  )
    throw new InvalidBillingWebhookError("Oferta do webhook não autorizada.");
}

function validateEventIdentifiers(details: ReturnType<typeof eventDetails>) {
  const providerIdentifiers = [
    details.transactionId,
    details.providerSubscriptionId,
    details.providerCustomerId,
  ];
  if (providerIdentifiers.some((identifier) => identifier.length > 255)) {
    throw new InvalidBillingWebhookError("Identificador do webhook inválido.");
  }
  if (
    details.checkoutContextId &&
    !/^[A-Za-z0-9_-]{10,80}$/.test(details.checkoutContextId)
  ) {
    throw new InvalidBillingWebhookError("Contexto do webhook inválido.");
  }
}

async function hotmartAccessToken() {
  const clientId = process.env.HOTMART_CLIENT_ID?.trim();
  const clientSecret = process.env.HOTMART_CLIENT_SECRET?.trim();
  const basic = process.env.HOTMART_BASIC_TOKEN?.trim();
  if (!clientId || !clientSecret || !basic) {
    throw new BillingNotConfiguredError(
      "Cancelamento exige HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET e HOTMART_BASIC_TOKEN.",
    );
  }
  const url = new URL("https://api-sec-vlc.hotmart.com/security/oauth/token");
  url.searchParams.set("grant_type", "client_credentials");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("A Hotmart recusou a autenticação do cancelamento.");
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("A Hotmart não retornou um access token.");
  return body.access_token;
}

class HotmartBillingService implements BillingService {
  async startCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const plan = getPlan(request.planId);
    if (!plan || !plan.active || plan.id === "free")
      throw new InvalidBillingWebhookError("Plano inválido ou indisponível.");
    if (!/^[A-Za-z0-9_-]{8,120}$/.test(request.idempotencyKey))
      throw new InvalidBillingWebhookError("Chave de idempotência inválida.");
    providerConfigured();
    const url = checkoutUrl();

    const prisma = getPrisma();
    const now = new Date();
    let context = await prisma.checkoutContext.findFirst({
      where: {
        userId: request.userId,
        provider: "hotmart",
        planId: plan.id,
        status: { in: ["STARTED", "REDIRECTED"] },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!context) {
      try {
        context = await prisma.checkoutContext.create({
          data: {
            userId: request.userId,
            provider: "hotmart",
            planId: plan.id,
            idempotencyKey: request.idempotencyKey,
            expiresAt: new Date(now.getTime() + 30 * 60_000),
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          context = await prisma.checkoutContext.findUnique({
            where: { idempotencyKey: request.idempotencyKey },
          });
        } else {
          throw error;
        }
      }
    }
    if (!context || context.userId !== request.userId)
      throw new InvalidBillingWebhookError("Contexto de checkout inválido.");

    url.searchParams.set("sck", `ll_${context.id}`);
    await prisma.checkoutContext.update({
      where: { id: context.id },
      data: { status: "REDIRECTED" },
    });
    await Promise.allSettled([
      recordProductEvent({
        userId: request.userId,
        name: "checkout_started",
        properties: { planId: plan.id, provider: "hotmart" },
      }),
      recordProductEvent({
        userId: request.userId,
        name: "checkout_redirected",
        properties: { planId: plan.id, provider: "hotmart" },
      }),
    ]);
    return { id: context.id, url: url.toString() };
  }

  async processWebhook(rawPayload: string, headers: Headers): Promise<BillingEvent> {
    if (!verifyHotmartWebhook(headers)) throw new InvalidBillingWebhookError();
    providerConfigured();
    let payload: JsonObject;
    try {
      payload = object(JSON.parse(rawPayload));
    } catch {
      throw new InvalidBillingWebhookError("Payload JSON inválido.");
    }
    const details = eventDetails(payload);
    if (!details.eventId || details.eventId.length > 160 || !details.eventType)
      throw new InvalidBillingWebhookError("Evento sem identificação válida.");
    if (details.version && details.version !== "2.0.0")
      throw new InvalidBillingWebhookError("Versão de webhook não suportada.");
    validateProduct(details);
    validateEventIdentifiers(details);

    const prisma = getPrisma();
    const payloadHash = createHash("sha256").update(rawPayload).digest("hex");
    const existing = await prisma.billingWebhookEvent.findUnique({
      where: {
        provider_externalId: { provider: "hotmart", externalId: details.eventId },
      },
    });
    if (existing && existing.payloadHash !== payloadHash) {
      throw new InvalidBillingWebhookError(
        "O identificador do evento já foi recebido com outro conteúdo.",
      );
    }
    if (existing && ["PROCESSED", "IGNORED"].includes(existing.status)) {
      return {
        id: details.eventId,
        provider: "hotmart",
        type: details.eventType,
        status: "duplicate",
      };
    }
    if (existing) {
      await prisma.billingWebhookEvent.update({
        where: { id: existing.id },
        data: { status: "RECEIVED", error: null, receivedAt: new Date() },
      });
    } else {
      try {
        await prisma.billingWebhookEvent.create({
          data: {
            provider: "hotmart",
            externalId: details.eventId,
            eventType: details.eventType,
            payloadHash,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return {
            id: details.eventId,
            provider: "hotmart",
            type: details.eventType,
            status: "duplicate",
          };
        }
        throw error;
      }
    }

    const status = mapHotmartEventStatus(details.eventType);
    if (!status) {
      await prisma.billingWebhookEvent.update({
        where: {
          provider_externalId: { provider: "hotmart", externalId: details.eventId },
        },
        data: { status: "IGNORED", processedAt: new Date() },
      });
      return {
        id: details.eventId,
        provider: "hotmart",
        type: details.eventType,
        status: "ignored",
      };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const context = details.checkoutContextId
          ? await tx.checkoutContext.findUnique({
              where: { id: details.checkoutContextId },
            })
          : null;
        const existingSubscription =
          (details.providerSubscriptionId
            ? await tx.subscription.findFirst({
                where: {
                  provider: "hotmart",
                  providerSubscriptionId: details.providerSubscriptionId,
                },
              })
            : null) ||
          (details.providerCustomerId
            ? await tx.subscription.findFirst({
                where: {
                  provider: "hotmart",
                  providerCustomerId: details.providerCustomerId,
                },
              })
            : null);
        const userId = context?.userId ?? existingSubscription?.userId;
        if (!userId)
          throw new InvalidBillingWebhookError(
            "O evento não está vinculado a um checkout conhecido.",
          );
        if (context && (context.provider !== "hotmart" || context.planId !== "premium-monthly"))
          throw new InvalidBillingWebhookError("Contexto de checkout incompatível.");

        const plan = status === "ACTIVE" || status === "CANCELED" ? "PRO" : "FREE";
        const cancelAtPeriodEnd = status === "CANCELED";
        const subscription = await tx.subscription.upsert({
          where: { userId },
          create: {
            userId,
            provider: "hotmart",
            providerCustomerId: details.providerCustomerId || null,
            providerSubscriptionId: details.providerSubscriptionId || null,
            plan,
            planId: "premium-monthly",
            status,
            currentPeriodStart: details.currentPeriodStart,
            currentPeriodEnd: details.currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt: cancelAtPeriodEnd ? new Date() : null,
          },
          update: {
            provider: "hotmart",
            ...(details.providerCustomerId
              ? { providerCustomerId: details.providerCustomerId }
              : {}),
            ...(details.providerSubscriptionId
              ? { providerSubscriptionId: details.providerSubscriptionId }
              : {}),
            plan,
            planId: "premium-monthly",
            status,
            ...(details.currentPeriodStart
              ? { currentPeriodStart: details.currentPeriodStart }
              : {}),
            ...(details.currentPeriodEnd
              ? { currentPeriodEnd: details.currentPeriodEnd }
              : {}),
            cancelAtPeriodEnd,
            canceledAt: cancelAtPeriodEnd ? new Date() : null,
          },
        });
        if (details.transactionId) {
          await tx.payment.upsert({
            where: {
              provider_externalId: {
                provider: "hotmart",
                externalId: details.transactionId,
              },
            },
            create: {
              userId,
              provider: "hotmart",
              externalId: details.transactionId,
              plan: "PRO",
              amountInCents: details.amountInCents,
              currency: details.currency.slice(0, 8),
              status,
              paidAt: status === "ACTIVE" ? new Date() : null,
              refundedAt: status === "REFUNDED" ? new Date() : null,
            },
            update: {
              status,
              amountInCents: details.amountInCents,
              currency: details.currency.slice(0, 8),
              ...(status === "ACTIVE" ? { paidAt: new Date() } : {}),
              ...(status === "REFUNDED" ? { refundedAt: new Date() } : {}),
            },
          });
        }
        if (context) {
          await tx.checkoutContext.update({
            where: { id: context.id },
            data: {
              status: status === "ACTIVE" ? "CONVERTED" : context.status,
              convertedAt: status === "ACTIVE" ? new Date() : context.convertedAt,
            },
          });
        }
        await tx.billingWebhookEvent.update({
          where: {
            provider_externalId: { provider: "hotmart", externalId: details.eventId },
          },
          data: { status: "PROCESSED", processedAt: new Date(), error: null },
        });
        const eventNames = [
          ...(status === "ACTIVE" ? ["payment_confirmed", "subscription_activated"] : []),
          ...(status === "CANCELED" ? ["subscription_canceled"] : []),
        ];
        for (const name of eventNames) {
          await tx.productEvent.create({
            data: {
              userId,
              name,
              properties: { provider: "hotmart", planId: "premium-monthly" },
            },
          });
        }
        return subscription;
      });
      return {
        id: details.eventId,
        provider: "hotmart",
        type: details.eventType,
        status: "processed",
        subscriptionStatus: result.status,
      };
    } catch (error) {
      await prisma.billingWebhookEvent.update({
        where: {
          provider_externalId: { provider: "hotmart", externalId: details.eventId },
        },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida",
        },
      });
      throw error;
    }
  }

  async cancel(userId: string): Promise<BillingSubscription> {
    providerConfigured();
    const prisma = getPrisma();
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (
      !subscription ||
      subscription.provider !== "hotmart" ||
      !subscription.providerCustomerId ||
      !["ACTIVE", "PAST_DUE"].includes(subscription.status)
    ) {
      throw new InvalidBillingWebhookError("Não há assinatura ativa para cancelar.");
    }
    const accessToken = await hotmartAccessToken();
    const base =
      process.env.HOTMART_SANDBOX === "true"
        ? "https://sandbox.hotmart.com"
        : "https://developers.hotmart.com";
    const response = await fetch(
      `${base}/payments/api/v1/subscriptions/${encodeURIComponent(subscription.providerCustomerId)}/cancel`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ send_mail: true }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new Error("A Hotmart não confirmou o cancelamento.");
    const responseText = await response.text();
    let responseBody: { date_next_charge?: string } = {};
    if (responseText) {
      try {
        responseBody = JSON.parse(responseText) as typeof responseBody;
      } catch {
        responseBody = {};
      }
    }
    const currentPeriodEnd = date(responseBody.date_next_charge);
    const updated = await prisma.subscription.update({
      where: { userId },
      data: {
        status: "CANCELED",
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
        ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
      },
    });
    await recordProductEvent({
      userId,
      name: "subscription_canceled",
      properties: { provider: "hotmart", source: "user" },
    });
    return subscriptionShape(updated);
  }

  async getSubscription(userId: string): Promise<BillingSubscription | null> {
    if (databasePersistenceMode() !== "postgres") return null;
    const subscription = await getPrisma().subscription.findUnique({
      where: { userId },
    });
    return subscription ? subscriptionShape(subscription) : null;
  }
}

export const billingService: BillingService = new HotmartBillingService();
