"use client";

import { useAppState } from "@/lib/app-state";

export type AppLocale = "pt-BR" | "en";

export function useAppLocale() {
  const { state, update } = useAppState();
  const locale = state.user.locale ?? "pt-BR";

  const setLocale = (next: AppLocale) => {
    document.documentElement.lang = next;
    update((current) => ({
      ...current,
      user: { ...current.user, locale: next },
    }));
  };

  return { locale, setLocale };
}
