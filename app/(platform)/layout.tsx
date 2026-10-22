import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { GUEST_COOKIE, guestAccount } from "@/services/auth/guest";
import {
  authMode,
  getSession,
  SESSION_COOKIE,
} from "@/services/auth/auth-store";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  {
    const cookieStore = await cookies();
    const guest = guestAccount(cookieStore.get(GUEST_COOKIE)?.value);
    const headerStore = await headers();
    const authenticated = guest ? null : await getSession(
      cookieStore.get(SESSION_COOKIE)?.value,
    );
    if (!authenticated && !guest && authMode() === "required") {
      const requested = headerStore.get("x-logiclab-pathname") ?? "/dashboard";
      const safeRequested =
        requested.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/dashboard";
      redirect(`/entrar?next=${encodeURIComponent(safeRequested)}`);
    }
    if (authenticated && !authenticated.account.emailVerifiedAt)
      redirect("/confirmar-email");
    if (authenticated && !authenticated.account.onboardingCompleted)
      redirect("/onboarding");
  }
  return <AppShell>{children}</AppShell>;
}
