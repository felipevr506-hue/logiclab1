import "server-only";

import type { Prisma } from "@prisma/client";
import { databasePersistenceMode, getPrisma } from "@/services/persistence/database";

export type ProductEventName =
  | "signup_started"
  | "signup_completed"
  | "login_success"
  | "onboarding_completed"
  | "pricing_viewed"
  | "checkout_started"
  | "checkout_redirected"
  | "payment_confirmed"
  | "subscription_activated"
  | "checkout_abandoned"
  | "subscription_canceled";

function safeProperties(properties: Record<string, unknown> | undefined) {
  if (!properties) return undefined;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties).slice(0, 20)) {
    if (/password|token|secret|authorization|card/i.test(key)) continue;
    if (typeof value === "string") safe[key.slice(0, 60)] = value.slice(0, 200);
    else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key.slice(0, 60)] = value;
    }
  }
  return safe as Prisma.InputJsonObject;
}

export async function recordProductEvent(input: {
  userId?: string;
  name: ProductEventName;
  properties?: Record<string, unknown>;
  sessionId?: string;
}) {
  if (databasePersistenceMode() !== "postgres") return;
  await getPrisma().productEvent.create({
    data: {
      userId: input.userId,
      name: input.name,
      properties: safeProperties(input.properties),
      sessionId: input.sessionId?.slice(0, 120),
    },
  });
}
