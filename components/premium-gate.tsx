import { cookies } from "next/headers";
import { Paywall } from "@/components/paywall";
import { authMode, getSession, SESSION_COOKIE } from "@/services/auth/auth-store";
import {
  hasEntitlement,
  type EntitlementKey,
} from "@/services/entitlements/entitlements";

export async function PremiumGate({
  feature,
  children,
}: {
  feature: EntitlementKey;
  children: React.ReactNode;
}) {
  if (authMode() === "demo") return children;
  const cookieStore = await cookies();
  const authenticated = await getSession(cookieStore.get(SESSION_COOKIE)?.value);
  const plan = authenticated?.account.plan === "PRO" ? "pro" : "free";
  return hasEntitlement(plan, feature) ? children : <Paywall />;
}
