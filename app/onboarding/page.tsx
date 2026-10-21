import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/onboarding";
import {
  authMode,
  getSession,
  SESSION_COOKIE,
} from "@/services/auth/auth-store";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  {
    const cookieStore = await cookies();
    const authenticated = await getSession(
      cookieStore.get(SESSION_COOKIE)?.value,
    );
    if (!authenticated && authMode() === "required")
      redirect("/entrar?next=%2Fonboarding");
    if (authenticated && !authenticated.account.emailVerifiedAt)
      redirect("/confirmar-email");
    if (authenticated?.account.onboardingCompleted) redirect("/dashboard");
  }
  return <Onboarding />;
}
