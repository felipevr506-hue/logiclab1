import "server-only";

import { databasePersistenceMode, getPrisma } from "@/services/persistence/database";
import {
  hasEntitlement,
  listEntitlements,
  type EntitlementKey,
  type ProductPlan,
} from "@/services/entitlements/entitlements";

export async function getServerPlan(userId: string): Promise<ProductPlan> {
  if (databasePersistenceMode() !== "postgres") return "free";
  const subscription = await getPrisma().subscription.findUnique({
    where: { userId },
    select: {
      plan: true,
      status: true,
      currentPeriodEnd: true,
    },
  });
  if (!subscription || subscription.plan !== "PRO") return "free";
  if (subscription.status === "ACTIVE") return "pro";
  if (
    subscription.status === "CANCELED" &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.getTime() > Date.now()
  ) {
    return "pro";
  }
  return "free";
}

export async function userHasEntitlement(
  userId: string,
  feature: EntitlementKey,
) {
  return hasEntitlement(await getServerPlan(userId), feature);
}

export async function getUserEntitlements(userId: string) {
  const plan = await getServerPlan(userId);
  return { plan, entitlements: listEntitlements(plan) };
}
