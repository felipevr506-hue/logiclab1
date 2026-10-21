"use client";

import { Moon, Sun } from "lucide-react";
import { useAppState } from "@/lib/app-state";

export function ThemeToggle() {
  const { state, update } = useAppState();
  const isDark = state.theme === "dark";
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => update({ theme: isDark ? "light" : "dark" })}
      disabled={!state.hydrated}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
