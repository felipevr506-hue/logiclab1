import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CheckoutSuccessPage } from "@/components/billing-pages";
import { authMode, getSession, SESSION_COOKIE } from "@/services/auth/auth-store";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccess() {
  if (authMode() === "required") {
    const cookieStore = await cookies();
    if (!(await getSession(cookieStore.get(SESSION_COOKIE)?.value)))
      redirect("/entrar?next=%2Fcheckout%2Fsucesso");
  }
  return <CheckoutSuccessPage />;
}
