"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="route-state">
      <span className="state-error">
        <AlertTriangle />
      </span>
      <h1>Algo deu errado.</h1>
      <p>
        Seu progresso já salvo continua seguro. Nenhum detalhe técnico sensível
        foi exibido.
      </p>
      <button className="button button-primary" onClick={reset}>
        <RefreshCcw /> Tentar novamente
      </button>
    </main>
  );
}
