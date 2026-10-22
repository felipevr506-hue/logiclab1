import type { AppState } from "./types";

export const AUTH_CHANGE_KEY = "logiclab-auth-change";

export type SessionAccount = {
  guest?: boolean;
  demo?: boolean;
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  plan: "FREE" | "PRO";
  onboardingCompleted?: boolean;
  locale?: "pt-BR" | "en";
  initialLanguage?: "javascript";
};

export function accountStorageKey(accountId: string) {
  if (!accountId) throw new Error("Missing storage owner.");
  return `logiclab-state-v2:${encodeURIComponent(accountId)}`;
}

export function trainingDatabaseName(accountId: string) {
  if (!accountId) throw new Error("Missing database owner.");
  return `logiclab-training-v2:${encodeURIComponent(accountId)}`;
}

export function ownsProgress(
  state: Partial<AppState>,
  account: SessionAccount,
) {
  return state.user?.accountId === account.id;
}

export function clearSessionPresentation() {
  try {
    for (const key of Object.keys(window.sessionStorage))
      if (key.startsWith("logiclab-auth-delivery:"))
        window.sessionStorage.removeItem(key);
    for (const key of [
      "logiclab:sidebar-scroll-top",
      "logiclab-admin-workout-preview",
      "logiclab-learning-exercise-access",
      "logiclab-session-owner",
    ])
      window.sessionStorage.removeItem(key);
  } catch {
    /* Storage may be disabled; identity must still change. */
  }
  document.cookie = "logiclab_locale=; Path=/; Max-Age=0; SameSite=Lax";
}

export function activateSessionPresentation(accountId: string | null) {
  try {
    const owner = accountId ?? "visitor";
    if (window.sessionStorage.getItem("logiclab-session-owner") !== owner) {
      clearSessionPresentation();
      window.sessionStorage.setItem("logiclab-session-owner", owner);
    }
  } catch {
    /* Presentation storage is optional. */
  }
}

export function announceAuthChange() {
  try {
    window.localStorage.setItem(AUTH_CHANGE_KEY, crypto.randomUUID());
  } catch {
    /* Other tabs also verify their session when focused. */
  }
}
