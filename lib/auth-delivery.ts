import type { AuthEmailDelivery } from "@/services/email/auth-email";
import { activateSessionPresentation } from "@/lib/account-storage";

const PREFIX = "logiclab-auth-delivery:";
export function rememberAuthDelivery(
  accountId: string,
  delivery: AuthEmailDelivery,
) {
  activateSessionPresentation(accountId);
  try {
    sessionStorage.setItem(
      PREFIX + encodeURIComponent(accountId),
      JSON.stringify(delivery),
    );
  } catch {
    /* Resend remains available. */
  }
}
export function readAuthDelivery(accountId: string): AuthEmailDelivery | null {
  try {
    const key = PREFIX + encodeURIComponent(accountId);
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as AuthEmailDelivery) : null;
  } catch {
    return null;
  }
}
