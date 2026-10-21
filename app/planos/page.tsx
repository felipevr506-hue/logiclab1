import { after } from "next/server";
import { cookies } from "next/headers";
import { PlansPage } from "@/components/billing-pages";
import { getSession, SESSION_COOKIE } from "@/services/auth/auth-store";
import { recordProductEvent } from "@/services/analytics/product-events";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const cookieStore = await cookies();
  const authenticated = await getSession(cookieStore.get(SESSION_COOKIE)?.value);
  const premiumActive = authenticated?.account.plan === "PRO";
  after(() =>
    recordProductEvent({
      userId: authenticated?.account.id,
      name: "pricing_viewed",
      sessionId: authenticated?.session.id,
    }).catch(() => undefined),
  );
  return (
    <PlansPage
      authenticated={Boolean(authenticated)}
      premiumActive={Boolean(premiumActive)}
    />
  );
}
