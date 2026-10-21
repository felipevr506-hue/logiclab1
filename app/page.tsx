import { LandingPage } from "@/components/landing-page";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE } from "@/services/auth/auth-store";

export default async function Home() {
  const session = await getSession(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  const continueHref = !session
    ? null
    : !session.account.emailVerifiedAt
      ? "/confirmar-email"
      : !session.account.onboardingCompleted
        ? "/onboarding"
        : "/dashboard";
  return <LandingPage continueHref={continueHref} />;
}
