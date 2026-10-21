"use client";

import { Languages } from "lucide-react";
import { useAppLocale } from "@/lib/use-app-locale";

export function LanguageSwitcher() {
  const { locale, setLocale } = useAppLocale();
  const next = locale === "pt-BR" ? "en" : "pt-BR";
  return (
    <button
      type="button"
      className="language-switcher"
      onClick={() => setLocale(next)}
      aria-label={locale === "pt-BR" ? "Use English" : "Usar português"}
      title={locale === "pt-BR" ? "Use English" : "Usar português"}
    >
      <Languages aria-hidden="true" /> {locale === "pt-BR" ? "PT" : "EN"}
    </button>
  );
}
