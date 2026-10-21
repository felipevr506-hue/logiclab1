"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/app-state";
import type { TutorMessage } from "@/lib/types";
import type { TutorIntent } from "@/services/ai/tutor";

type ChatPayload = {
  messages: TutorMessage[];
  available?: boolean;
  mode: "online" | "test";
  error?: string;
  safetyFiltered?: boolean;
};
const labels = {
  hint: "Me dê uma dica",
  "explain-error": "Explique meu erro",
  "analyze-logic": "Analise minha lógica",
  confused: "Não entendi",
};
export function useTutorChat(
  exerciseId: string,
  code: string,
  open: boolean,
  browserError?: string,
) {
  const { state, update } = useAppState();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const [mode, setMode] = useState<"online" | "test">("online");
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const lastRequest = useRef<{ intent: TutorIntent; question?: string } | null>(
    null,
  );
  const merge = useCallback(
    (messages: TutorMessage[]) => {
      update((current) => ({
        ...current,
        tutorMessages: {
          ...current.tutorMessages,
          [exerciseId]: Array.from(
            new Map(
              [...(current.tutorMessages[exerciseId] ?? []), ...messages].map(
                (m) => [m.id, m],
              ),
            ).values(),
          ).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        },
      }));
    },
    [exerciseId, update],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuestion("");
      setAvailable(false);
      setError(null);
      lastRequest.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [exerciseId]);
  useEffect(() => {
    if (!open || !state.hydrated) return;
    const controller = new AbortController();
    void fetch(`/api/tutor/chat?exerciseId=${encodeURIComponent(exerciseId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as ChatPayload;
        if (!response.ok)
          throw Error(data.error ?? "Não foi possível carregar o Tutor.");
        if (controller.signal.aborted) return;
        merge(data.messages);
        setAvailable(data.available === true);
        setMode(data.mode);
        setError(
          data.available
            ? null
            : "Tutor IA não configurado ou indisponível. O exercício continua funcionando normalmente.",
        );
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setAvailable(false);
          setError(e instanceof Error ? e.message : "Tutor indisponível.");
        }
      });
    return () => controller.abort();
  }, [open, exerciseId, state.hydrated, merge, refresh]);
  useEffect(() => () => pending.current?.abort(), [exerciseId]);
  const send = async (intent: TutorIntent, options?: { question?: string }) => {
    if (pending.current || !available) return;
    if (intent === "request-solution") return;
    const message =
      intent === "question"
        ? (options?.question ?? question).trim()
        : labels[intent];
    if (!message) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setNotice(null);
    lastRequest.current = { intent, question: message };
    try {
      const response = await fetch("/api/tutor/chat", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-logiclab-request": "same-origin",
        },
        body: JSON.stringify({
          exerciseId,
          requestId: crypto.randomUUID(),
          message,
          code,
          intent,
          ...(browserError ? { browserError: browserError.slice(0, 400) } : {}),
        }),
      });
      const data = (await response.json()) as ChatPayload;
      if (!response.ok)
        throw Error(data.error ?? "Tutor indisponível. Tente novamente.");
      if (controller.signal.aborted) return;
      merge(data.messages);
      setMode(data.mode);
      setNotice(
        data.safetyFiltered
          ? "Resposta ajustada pela política pedagógica para preservar seu raciocínio."
          : null,
      );
      setQuestion((current) => (current.trim() === message ? "" : current));
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "Geração interrompida. Seu texto foi mantido."
          : e instanceof Error
            ? e.message
            : "Não foi possível responder. Seu texto foi mantido.",
      );
    } finally {
      pending.current = null;
      setBusy(false);
    }
  };
  return {
    question,
    setQuestion,
    busy,
    available,
    mode,
    error,
    notice,
    messages: state.tutorMessages[exerciseId] ?? [],
    send,
    stop: () => pending.current?.abort(),
    retry: () =>
      lastRequest.current && available
        ? send(lastRequest.current.intent, {
            question: lastRequest.current.question,
          })
        : setRefresh((value) => value + 1),
  };
}
