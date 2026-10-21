"use client";

import {
  CheckCircle2,
  Clock3,
  Code2,
  Flame,
  History,
  MessageSquareText,
  Trophy,
  XCircle,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { exercises } from "@/lib/content";
import { addDaysToDateKey, getBrasiliaDateKey } from "@/lib/daily-workouts";

type ActivityEvent = {
  id: string;
  createdAt: string;
  title: string;
  detail: string;
  kind: "success" | "attempt" | "xp" | "code" | "saved";
};

export function ActivityPage() {
  const { state } = useAppState();
  const events: ActivityEvent[] = [
    ...state.attemptHistory.map((attempt) => ({
      id: `attempt-${attempt.id}`,
      createdAt: attempt.createdAt,
      title: `${attempt.passed ? "Concluiu" : "Tentou"} “${
        exercises.find((item) => item.id === attempt.exerciseId)?.title ??
        attempt.exerciseId
      }”`,
      detail: `${attempt.passedTests} testes passaram · ${attempt.failedTests} falharam · ${attempt.hintsUsed} dicas`,
      kind: (attempt.passed ? "success" : "attempt") as ActivityEvent["kind"],
    })),
    ...state.xpTransactions.map((transaction) => ({
      id: `xp-${transaction.id}`,
      createdAt: transaction.createdAt,
      title: `+${transaction.amount} XP`,
      detail: transaction.description,
      kind: "xp" as const,
    })),
    ...state.codeVersions
      .filter((version) =>
        ["manual", "restore", "import", "conflict"].includes(version.reason),
      )
      .map((version) => ({
        id: `version-${version.id}`,
        createdAt: version.createdAt,
        title:
          version.reason === "conflict"
            ? "Versão em conflito preservada"
            : version.reason === "import"
              ? "Código importado"
              : version.reason === "restore"
                ? "Versão restaurada"
                : "Versão de código salva",
        detail: `${version.sourceId} · ${version.language}`,
        kind: "code" as const,
      })),
    ...state.savedTutorExplanations.map((item) => ({
      id: `explanation-${item.id}`,
      createdAt: item.createdAt,
      title: "Salvou uma explicação do tutor",
      detail: item.title,
      kind: "saved" as const,
    })),
  ].toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));

  const groups = Object.entries(
    events.reduce<Record<string, ActivityEvent[]>>((result, event) => {
      const date = getBrasiliaDateKey(new Date(event.createdAt));
      result[date] = [...(result[date] ?? []), event];
      return result;
    }, {}),
  ).sort(([a], [b]) => b.localeCompare(a));
  const today = getBrasiliaDateKey();
  const yesterday = addDaysToDateKey(today, -1);
  const icons = {
    success: CheckCircle2,
    attempt: XCircle,
    xp: Trophy,
    code: Code2,
    saved: MessageSquareText,
  };

  return (
    <main className="standard-page activity-page">
      <header className="page-intro">
        <div>
          <span>HISTÓRICO REAL</span>
          <h1>Minha atividade</h1>
          <p>
            Tentativas, XP, versões e materiais salvos, registrados a partir de
            eventos reais da plataforma.
          </p>
        </div>
      </header>
      {groups.length ? (
        <section className="activity-timeline">
          {groups.map(([date, dayEvents]) => (
            <div className="activity-day" key={date}>
              <h2>
                <Clock3 />
                {date === today
                  ? "Hoje"
                  : date === yesterday
                    ? "Ontem"
                    : new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "long",
                        timeZone: "America/Sao_Paulo",
                      }).format(new Date(`${date}T12:00:00-03:00`))}
              </h2>
              <div>
                {dayEvents.map((event) => {
                  const Icon = icons[event.kind];
                  return (
                    <article className={event.kind} key={event.id}>
                      <span>
                        <Icon />
                      </span>
                      <div>
                        <b>{event.title}</b>
                        <p>{event.detail}</p>
                      </div>
                      <time>
                        {new Intl.DateTimeFormat("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Sao_Paulo",
                        }).format(new Date(event.createdAt))}
                      </time>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="empty-state compact">
          <History />
          <h3>Sua atividade começará no primeiro treino</h3>
          <p>
            Executar no Playground não gera XP, mas versões salvas aparecem
            aqui.
          </p>
        </div>
      )}
      {state.streak > 0 && (
        <footer className="activity-streak panel-card">
          <Flame /> Sequência atual: <b>{state.streak} dias</b>
        </footer>
      )}
    </main>
  );
}
