"use client";
import { useState } from "react";
import { CheckCircle2, ThumbsUp, AlertTriangle } from "lucide-react";
import type { ExerciseFeedback } from "@/lib/types";
export function FeedbackPanel({
  exerciseId,
  alreadySent,
  onSubmit,
}: {
  exerciseId: string;
  alreadySent: boolean;
  onSubmit: (
    feedback: Omit<ExerciseFeedback, "id" | "status" | "createdAt">,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"rating" | "report">("rating");
  const [sent, setSent] = useState(false);
  const [sentiment, setSentiment] =
    useState<ExerciseFeedback["sentiment"]>("good");
  const [reportReason, setReportReason] =
    useState<ExerciseFeedback["reportReason"]>("unclear-statement");
  const [comment, setComment] = useState("");

  if (sent || (alreadySent && !open)) {
    return (
      <div className="exercise-feedback compact-feedback">
        <CheckCircle2 /> Feedback registrado. Obrigado por ajudar a melhorar.
      </div>
    );
  }

  return (
    <div className="exercise-feedback">
      {!open ? (
        <div>
          <span>Como foi este exercício?</span>
          <button
            type="button"
            onClick={() => {
              setMode("rating");
              setOpen(true);
            }}
          >
            <ThumbsUp /> Avaliar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("report");
              setOpen(true);
            }}
          >
            <AlertTriangle /> Reportar problema
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              exerciseId,
              sentiment: mode === "rating" ? sentiment : "problem",
              reportReason: mode === "report" ? reportReason : undefined,
              comment: comment.trim() || undefined,
            });
            setSent(true);
          }}
        >
          <b>{mode === "rating" ? "Avaliar exercício" : "Reportar problema"}</b>
          {mode === "rating" ? (
            <select
              aria-label="Avaliação do exercício"
              value={sentiment}
              onChange={(event) =>
                setSentiment(
                  event.target.value as ExerciseFeedback["sentiment"],
                )
              }
            >
              <option value="too-easy">Fácil demais</option>
              <option value="good">Na medida</option>
              <option value="confusing">Confuso</option>
            </select>
          ) : (
            <select
              aria-label="Motivo do problema"
              value={reportReason}
              onChange={(event) =>
                setReportReason(
                  event.target.value as ExerciseFeedback["reportReason"],
                )
              }
            >
              <option value="unclear-statement">Enunciado pouco claro</option>
              <option value="incorrect-test">Teste parece incorreto</option>
              <option value="incorrect-solution">
                Solução parece incorreta
              </option>
              <option value="technical">Problema técnico</option>
              <option value="translation">Texto ou tradução</option>
              <option value="other">Outro</option>
            </select>
          )}
          <input
            aria-label="Comentário opcional"
            placeholder="Comentário opcional"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <button className="button button-primary">Enviar feedback</button>
          <button type="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}
