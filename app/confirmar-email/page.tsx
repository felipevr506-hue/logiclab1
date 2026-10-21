import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, SESSION_COOKIE } from "@/services/auth/auth-store";
import { ConfirmEmailFlow } from "@/components/email-verification";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Confirme seu e-mail",
  robots: { index: false, follow: false },
};
export default async function ConfirmEmailPage() {
  const session = await getSession(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/entrar");
  if (session.account.emailVerifiedAt)
    redirect(
      session.account.onboardingCompleted ? "/dashboard" : "/onboarding",
    );
  return (
    <ConfirmEmailFlow
      account={{
        id: session.account.id,
        email: session.account.email,
        username: session.account.username,
      }}
    />
  );
}
