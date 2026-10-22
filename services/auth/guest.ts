import "server-only";
import type { SessionAccount } from "@/lib/account-storage";

export const GUEST_COOKIE = "logiclab_guest";

export function guestAccount(token: string | undefined): SessionAccount | null {
  if (!token || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token))
    return null;
  return {
    id: `guest:${token}`,
    name: "Convidado",
    email: "guest@logiclab.invalid",
    role: "STUDENT",
    plan: "FREE",
    onboardingCompleted: true,
    locale: "pt-BR",
    initialLanguage: "javascript",
    demo: true,
    guest: true,
  };
}
