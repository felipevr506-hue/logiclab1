import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
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
    const headerStore = await headers();
    const authenticated = await getSession(
      cookieStore.get(SESSION_COOKIE)?.value,
    );
    if (!authenticated && authMode() === "required") {
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
