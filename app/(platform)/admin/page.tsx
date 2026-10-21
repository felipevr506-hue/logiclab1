import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminPage } from "@/components/platform-pages";
import {
  authMode,
  getDevelopmentPrincipal,
  getSession,
  SESSION_COOKIE,
} from "@/services/auth/auth-store";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const authenticated = await getSession(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  if (authenticated) {
    if (authenticated.account.role !== "ADMIN") redirect("/dashboard");
  } else if (authMode() === "demo") {
    if (getDevelopmentPrincipal()?.account.role !== "ADMIN") redirect("/dashboard");
  } else {
    redirect("/dashboard");
  }
  return <AdminPage />;
}
