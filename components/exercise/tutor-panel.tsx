"use client";
import { useEffect, useRef } from "react";
import {
  Bot,
  MessageCircle,
  BookmarkPlus,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  XCircle,
  Code2,
  BookOpen,
  Send,
  History,
  CheckCircle2,
} from "lucide-react";
import type { TutorMessage, AttemptRecord } from "@/lib/types";
import type { TutorIntent } from "@/services/ai/tutor";
export function TutorPanel({
  active,
  onClose,
  busy,
  available,
  mode,
  error,
  notice,
  onRetry,
  onStop,
  messages,
  attempts,
  question,
  savedMessageIds,
  messageFeedback,
  onMessageFeedback,
  onSaveMessage,
  onQuestionChange,
  onAsk,
  onSubmitQuestion,
}: {
  active: boolean;
  onClose: () => void;
  busy: boolean;
  available: boolean;
  mode: "online" | "test";
  error: string | null;
  notice: string | null;
  onRetry: () => void;
  onStop: () => void;
  messages: TutorMessage[];
  attempts: AttemptRecord[];
  question: string;
  savedMessageIds: string[];
  messageFeedback: Record<string, boolean>;
  onMessageFeedback: (id: string, helpful: boolean) => void;
  onSaveMessage: (message: TutorMessage) => void;
  onQuestionChange: (value: string) => void;
  onAsk: (intent: TutorIntent) => Promise<void>;
  onSubmitQuestion: () => void;
}) {
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    conversation.scrollTo({
      top: conversation.scrollHeight,
      behavior: busy ? "smooth" : "auto",
    });
  }, [busy, messages.length]);

  return (
    <aside className={`tutor-panel ${active ? "mobile-active" : ""}`}>
      <header className="tutor-header">
        <span>
          <Bot />
        </span>
        <div>
          <b>Tutor de lógica</b>
          <small>
            {available && !error
              ? mode === "test"
                ? "Provider fictício · somente testes"
                : "Tutor IA disponível"
              : "Tutor IA indisponível"}
          </small>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar Tutor">
          <XCircle /> Fechar Tutor
        </button>
      </header>

      <div
        className="tutor-conversation"
        aria-label="Mensagens do Tutor — área rolável"
        aria-live="polite"
        ref={conversationRef}
        role="log"
        tabIndex={0}
      >
        <div className="tutor-message tutor">
          <span>
            <Bot />
          </span>
          <div>
            <p>
              {available
                ? "Vamos conversar sobre o enunciado, seu código e os resultados. Vou orientar seu raciocínio com perguntas e dicas, sem entregar a resposta pronta."
                : "Você pode continuar programando normalmente. Quando o Tutor estiver disponível, sua conversa aparecerá aqui."}
            </p>
            <small>Nível 1 · pista curta</small>
          </div>
        </div>
        {messages.map((message) => (
          <div className={`tutor-message ${message.role}`} key={message.id}>
            <span>
              {message.role === "tutor" ? <Bot /> : <MessageCircle />}
            </span>
            <div>
              <p>
                {message.helpLevel === 5
                  ? "Resposta completa antiga ocultada. Peça uma dica para continuar construindo sua resposta."
                  : message.content}
              </p>
              <small>
                {message.role === "tutor" && message.helpLevel
                  ? `Nível ${message.helpLevel}${message.errorKind ? ` · ${message.errorKind}` : ""}`
                  : "Você"}
              </small>
              {message.role === "tutor" && message.helpLevel !== 5 && (
                <div className="tutor-message-actions">
                  <button
                    type="button"
                    className="save-tutor-message"
                    disabled={savedMessageIds.includes(message.id)}
                    onClick={() => onSaveMessage(message)}
                  >
                    <BookmarkPlus />
                    {savedMessageIds.includes(message.id)
                      ? "Salvo no caderno"
                      : "Salvar explicação"}
                  </button>
                  <span>Ajudou?</span>
                  <button
                    type="button"
                    aria-label="A resposta do Tutor ajudou"
                    disabled={message.id in messageFeedback}
                    onClick={() => {
                      onMessageFeedback(message.id, true);
                      void fetch("/api/tutor/feedback", {
                        method: "POST",
                        keepalive: true,
                        headers: {
                          "content-type": "application/json",
                          "x-logiclab-request": "same-origin",
                        },
                        body: JSON.stringify({
                          messageId: message.id,
                          exerciseId: message.exerciseId,
                          helpful: true,
                        }),
                      });
                    }}
                  >
                    <ThumbsUp />
                  </button>
                  <button
                    type="button"
                    aria-label="A resposta do Tutor não ajudou"
                    disabled={message.id in messageFeedback}
                    onClick={() => {
                      onMessageFeedback(message.id, false);
                      void fetch("/api/tutor/feedback", {
                        method: "POST",
                        keepalive: true,
                        headers: {
                          "content-type": "application/json",
                          "x-logiclab-request": "same-origin",
                        },
                        body: JSON.stringify({
                          messageId: message.id,
                          exerciseId: message.exerciseId,
                          helpful: false,
                        }),
                      });
                    }}
                  >
                    <ThumbsDown />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="tutor-message tutor tutor-thinking">
            <span>
              <Bot />
            </span>
            <div>
              <p
                className="tutor-thinking-bubble"
                aria-label="Tutor está pensando..."
                role="status"
              >
                <span />
                <span />
                <span />
              </p>
              <small>Tutor está pensando...</small>
            </div>
          </div>
        )}
      </div>

      <div className="tutor-controls">
        {notice && <p role="status">{notice}</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button type="button" onClick={onRetry} disabled={busy}>
              Tentar novamente
            </button>
          </div>
        )}
        {busy && (
          <button type="button" onClick={onStop}>
            Interromper geração
          </button>
        )}
        <div className="tutor-quick-actions">
          <button
            disabled={busy || !available}
            onClick={() => void onAsk("hint")}
          >
            <Lightbulb /> Me dê uma dica
          </button>
          <button
            disabled={busy || !available}
            onClick={() => void onAsk("explain-error")}
          >
            <XCircle /> Explique meu erro
          </button>
          <button
            disabled={busy || !available}
            onClick={() => void onAsk("analyze-logic")}
          >
            <Code2 /> Analise minha lógica
          </button>
          <button
            disabled={busy || !available}
            onClick={() => void onAsk("confused")}
          >
            <BookOpen /> Não entendi
          </button>
        </div>
        <form
          className="tutor-question"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitQuestion();
          }}
        >
          <textarea
            aria-label="Pergunta para o tutor"
            placeholder="Pergunte sobre sua lógica..."
            value={question}
            maxLength={2000}
            rows={2}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (!busy && available && question.trim()) onSubmitQuestion();
              }
            }}
            onChange={(event) => onQuestionChange(event.target.value)}
          />
          <button
            aria-label="Enviar pergunta ao tutor"
            disabled={busy || !available || !question.trim()}
          >
            <Send />
          </button>
        </form>
        <details className="attempt-history">
          <summary>
            <History /> Histórico de tentativas <span>{attempts.length}</span>
          </summary>
          {attempts.length ? (
            <div>
              {attempts.map((attempt) => (
                <article key={attempt.id}>
                  <span className={attempt.passed ? "passed" : "failed"}>
                    {attempt.passed ? <CheckCircle2 /> : <XCircle />}
                  </span>
                  <div>
                    <b>Tentativa {attempt.attemptNumber}</b>
                    <small>
                      {attempt.passedTests} passou · {attempt.failedTests}{" "}
                      falhou · {attempt.hintsUsed} dicas
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Envie sua resposta para registrar a primeira tentativa.</p>
          )}
        </details>
      </div>
    </aside>
  );
}
