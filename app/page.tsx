import { LandingPage } from "@/components/landing-page";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE } from "@/services/auth/auth-store";
import { GUEST_COOKIE, guestAccount } from "@/services/auth/guest";

export default async function Home() {
  const cookieStore = await cookies();
  const guest = guestAccount(cookieStore.get(GUEST_COOKIE)?.value);
  const session = guest ? null : await getSession(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const continueHref = guest ? "/dashboard" : !session
    ? null
    : !session.account.emailVerifiedAt
      ? "/confirmar-email"
      : !session.account.onboardingCompleted
        ? "/onboarding"
        : "/dashboard";
  return <LandingPage continueHref={continueHref} />;
}
