"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BookOpen,
  Code2,
  FileCode2,
  Keyboard,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Send,
  Terminal,
  Trophy,
} from "lucide-react";
import { exercises } from "@/lib/content";
import type { DailyWorkout } from "@/lib/daily-workouts";
import { useAppState } from "@/lib/app-state";
import { browserCodeRunner } from "@/services/code-runner/browser-runner";
import { useTutorChat } from "./exercise/use-tutor-chat";
import type { ExecutionResult, TestResult } from "@/services/code-runner/types";
import { CodeVersionTools } from "@/components/code-version-tools";

import { ProblemPanel } from "./exercise/problem-panel";
import { TutorPanel } from "./exercise/tutor-panel";
import { FeedbackPanel } from "./exercise/feedback-panel";
import { ResultsPanel } from "./exercise/results-panel";
import styles from "./exercise/workspace.module.css";

const MonacoEditor = dynamic(() => import("@/components/local-monaco-editor"), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      <LoaderCircle /> Preparando editor...
    </div>
  ),
});

export function TrainingWorkspace({
  initialExerciseId,
  workout,
  startInPractice = false,
  activityMode = "path",
  projectId,
  assessmentId,
}: {
  initialExerciseId: string;
  workout: DailyWorkout;
  adminPreview?: boolean;
  startInPractice?: boolean;
  activityMode?: "path" | "practice" | "project" | "assessment";
  projectId?: string;
  assessmentId?: string;
}) {
  const {
    state,
    update,
    saveDraft,
    recordAttempt,
    requestHint,
    toggleFavorite,
    recordCodeVersion,
    saveTutorExplanation,
    submitExerciseFeedback,
  } = useAppState();
  const trainingExercises = exercises.filter(
    (item) => item.id === workout.exerciseId,
  );
  const initialIndex = Math.max(
    0,
    trainingExercises.findIndex((item) => item.id === initialExerciseId),
  );
  const exerciseIndex = initialIndex;
  const exercise = trainingExercises[exerciseIndex];
  const [code, setCode] = useState(
    state.drafts[exercise.id] ?? exercise.starterCode,
  );
  const [consoleResult, setConsoleResult] = useState<ExecutionResult | null>(
    null,
  );
  const [tests, setTests] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const submissionBusy = useRef(false);
  const [hintCount, setHintCount] = useState(state.hintsUsed[exercise.id] ?? 0);
  const [celebrate, setCelebrate] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<
    "instructions" | "editor" | "tutor"
  >(startInPractice ? "editor" : "instructions");
  const [tutorOpen, setTutorOpen] = useState(false);
  const tutorToggle = useRef<HTMLButtonElement>(null);
  const [pendingValidation, setPendingValidation] = useState<string | null>(
    null,
  );
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [, setConsoleTab] = useState<"console" | "tests">("console");
  const [runtimeInput, setRuntimeInput] = useState(
    exercise.runExample?.defaultValue ?? "",
  );
  const [tutorFeedback, setTutorFeedback] = useState<Record<string, boolean>>(
    {},
  );
  const [typingNotice, setTypingNotice] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(max-width: 820px)").matches) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [mobilePanel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCode(state.drafts[exercise.id] ?? exercise.starterCode);
      setConsoleResult(null);
      setTests(null);
      setHintCount(state.hintsUsed[exercise.id] ?? 0);
      setPendingValidation(null);
      setConsoleTab("console");
      setRuntimeInput(exercise.runExample?.defaultValue ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [exercise.id, state.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const closeExpandedEditor = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditorExpanded(false);
        setShortcutsOpen(false);
      }
    };
    window.addEventListener("keydown", closeExpandedEditor);
    return () => window.removeEventListener("keydown", closeExpandedEditor);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft(exercise.id, code), 120);
    return () => window.clearTimeout(timer);
  }, [code, exercise.id, saveDraft]);

  useEffect(() => {
    const analysisDisabled =
      activityMode === "assessment" ||
      !code.trim() ||
      code === exercise.starterCode;
    const timer = window.setTimeout(
      () => {
        if (analysisDisabled) {
          setTypingNotice(null);
          return;
        }
        const pairs = [
          ["{", "}"],
          ["(", ")"],
          ["[", "]"],
        ] as const;
        if (
          pairs.some(
            ([open, close]) =>
              code.split(open).length !== code.split(close).length,
          )
        ) {
          setTypingNotice(
            "Revise os pares de chaves, parênteses ou colchetes.",
          );
        } else if (/nota\s*>\s*7/.test(code)) {
          setTypingNotice(
            "Observe com cuidado o comportamento no valor limite 7.",
          );
        } else if (/printl\s*\(/.test(code)) {
          setTypingNotice("Um nome de método parece estar incompleto.");
        } else if (/for\s*\([^;]+;[^;]+;[^)]*--/.test(code)) {
          setTypingNotice(
            "O contador pode estar caminhando na direção errada.",
          );
        } else {
          setTypingNotice(null);
        }
      },
      analysisDisabled ? 0 : 1_300,
    );
    return () => window.clearTimeout(timer);
  }, [activityMode, code, exercise.starterCode]);

  const chat = useTutorChat(
    exercise.id,
    code,
    tutorOpen && activityMode !== "assessment",
    consoleResult?.error?.message,
  );
  const {
    question: tutorQuestion,
    setQuestion: setTutorQuestion,
    busy: tutorBusy,
    messages: tutorMessages,
    send: askTutor,
  } = chat;
  const exerciseAttempts = state.attemptHistory
    .filter((attempt) => attempt.exerciseId === exercise.id)
    .toReversed();
  const syntaxError =
    tests?.find((test) => test.error?.kind === "syntax")?.error ??
    consoleResult?.error;
  const runCode = async () => {
    recordCodeVersion({
      scope: activityMode === "project" ? "project" : "exercise",
      sourceId: exercise.id,
      language: exercise.language ?? "javascript",
      code,
      reason: "run",
    });
    setPendingValidation(null);
    setRunning(true);
    setTests(null);
    setConsoleTab("console");
    let input: unknown = runtimeInput;
    if (exercise.runExample?.inputKind === "number")
      input = Number(runtimeInput);
    if (exercise.runExample?.inputKind === "json") {
      try {
        input = JSON.parse(runtimeInput);
      } catch {
        setConsoleResult({
          logs: [],
          durationMs: 0,
          error: {
            kind: "runtime",
            message:
              "A entrada não é um JSON válido. Revise aspas, vírgulas e chaves.",
          },
        });
        setRunning(false);
        return;
      }
    }
    const result = await browserCodeRunner.run(code, {
      expression: exercise.runExample?.expression,
      input: exercise.runExample ? input : undefined,
    });
    setConsoleResult(result);
    setRunning(false);
  };

  const submitCode = async () => {
    if (submissionBusy.current) return;
    submissionBusy.current = true;
    recordCodeVersion({
      scope: activityMode === "project" ? "project" : "exercise",
      sourceId: exercise.id,
      language: exercise.language ?? "javascript",
      code,
      reason: "submit",
    });
    setPendingValidation(null);
    setRunning(true);
    setConsoleResult(null);
    setConsoleTab("tests");
    try {
      const official = await recordAttempt({
        exerciseId: exercise.id,
        code,
        activityMode,
        projectId,
        assessmentId,
      });
      if (official.evaluationStatus === "pending") {
        setPendingValidation(official.message);
        setTests(null);
        setConsoleTab("console");
        setConsoleResult(null);
        return;
      }
      const results: TestResult[] = official.attempt.testResults;
      setTests(results.length ? results : null);
      if (!results.length) {
        setConsoleTab("console");
        setConsoleResult({
          logs: [],
          durationMs: 0,
          error: { kind: "syntax", message: official.message },
        });
      }
      if (official.attempt.passed)
        recordCodeVersion({
          scope: activityMode === "project" ? "project" : "exercise",
          sourceId: exercise.id,
          language: exercise.language ?? "javascript",
          code,
          reason: "complete",
        });
      if (official.firstCompletion && !official.replayed) {
        setCelebrate(true);
        window.setTimeout(() => setCelebrate(false), 4200);
      }
    } catch (error) {
      setTests(null);
      setConsoleTab("console");
      setConsoleResult({
        logs: [],
        durationMs: 0,
        error: {
          kind: "runtime",
          message:
            error instanceof Error
              ? error.message
              : "A tentativa não foi confirmada pelo servidor.",
        },
      });
    } finally {
      setRunning(false);
      submissionBusy.current = false;
    }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        void submitCode();
      } else if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        void runCode();
      } else if (event.altKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setTutorOpen(true);
        setMobilePanel("tutor");
      } else if (
        event.ctrlKey &&
        event.altKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        setEditorExpanded((expanded) => !expanded);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  const revealHint = () => {
    void requestHint(exercise.id)
      .then(setHintCount)
      .catch((error) => {
        setConsoleTab("console");
        setConsoleResult({
          logs: [],
          durationMs: 0,
          error: {
            kind: "runtime",
            message:
              error instanceof Error
                ? error.message
                : "Não foi possível registrar a dica.",
          },
        });
      });
  };
  const resetCode = () => {
    setPendingValidation(null);
    setCode(exercise.starterCode);
    setTests(null);
    setConsoleResult(null);
    setConsoleTab("console");
  };

  const resultStatus = useMemo(() => {
    if (!tests) return null;
    if (tests.every((test) => test.passed)) return "success";
    if (tests.some((test) => test.error?.kind === "syntax")) return "syntax";
    return "logic";
  }, [tests]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/dashboard" className="back-link">
          <ArrowLeft /> Sair do treino
        </Link>
        <span>{workout.title}</span>
        {activityMode !== "assessment" && state.featureFlags.AI_TUTOR && (
          <button
            ref={tutorToggle}
            type="button"
            className="button button-secondary"
            aria-expanded={tutorOpen}
            aria-controls="exercise-tutor"
            onClick={() => {
              setTutorOpen(!tutorOpen);
              setMobilePanel(tutorOpen ? "editor" : "tutor");
            }}
          >
            <Bot />
            {tutorOpen ? "Fechar Tutor" : "Abrir Tutor"}
          </button>
        )}
      </header>
      {celebrate && (
        <p className={styles.reward} role="status">
          <Trophy /> Exercício concluído · +{state.lastXpAward?.amount ?? 0} XP
        </p>
      )}
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Área do exercício"
        onKeyDown={(event) => {
          const tabs = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              '[role="tab"]',
            ),
          );
          const current = tabs.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const index =
            event.key === "ArrowRight"
              ? (current + 1) % tabs.length
              : event.key === "ArrowLeft"
                ? (current - 1 + tabs.length) % tabs.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : -1;
          if (index < 0) return;
          event.preventDefault();
          tabs[index].focus();
          tabs[index].click();
        }}
      >
        <button
          role="tab"
          aria-selected={mobilePanel === "instructions"}
          tabIndex={mobilePanel === "instructions" ? 0 : -1}
          onClick={() => setMobilePanel("instructions")}
        >
          <BookOpen /> Problema
        </button>
        <button
          role="tab"
          aria-selected={mobilePanel === "editor"}
          tabIndex={mobilePanel === "editor" ? 0 : -1}
          onClick={() => setMobilePanel("editor")}
        >
          <Code2 /> Código
        </button>
        {activityMode !== "assessment" && state.featureFlags.AI_TUTOR && (
          <button
            role="tab"
            aria-selected={mobilePanel === "tutor"}
            tabIndex={mobilePanel === "tutor" ? 0 : -1}
            onClick={() => {
              setTutorOpen(true);
              setMobilePanel("tutor");
            }}
          >
            <Bot /> Tutor
          </button>
        )}
      </div>
      <div className={styles.workspace} data-tutor-open={tutorOpen}>
        <ProblemPanel
          exercise={exercise}
          workout={workout}
          active={mobilePanel === "instructions"}
          hintCount={hintCount}
          onHint={revealHint}
          assessment={activityMode === "assessment"}
          favorite={state.favorites.includes(exercise.id)}
          onFavorite={() => toggleFavorite(exercise.id)}
        />
        <section
          className={`code-panel ${mobilePanel === "editor" ? "mobile-active" : ""} ${exercise.runExample ? "has-runtime-input" : ""} ${editorExpanded ? "editor-expanded" : ""}`}
        >
          <div className="editor-toolbar">
            <div>
              <span>
                <FileCode2 /> main.js
              </span>
              <span className="language-dot">JavaScript</span>
            </div>
            <div>
              <details className={styles.settings}>
                <summary>Opções do editor</summary>
                <div
                  className="editor-font-controls"
                  aria-label="Tamanho da fonte do editor"
                >
                  <button
                    type="button"
                    title="Diminuir fonte do editor"
                    aria-label="Diminuir fonte do editor"
                    disabled={state.editorFontSize <= 15}
                    onClick={() =>
                      update({
                        editorFontSize: Math.max(15, state.editorFontSize - 1),
                      })
                    }
                  >
                    A−
                  </button>
                  <span aria-live="polite">{state.editorFontSize}px</span>
                  <button
                    type="button"
                    title="Aumentar fonte do editor"
                    aria-label="Aumentar fonte do editor"
                    disabled={state.editorFontSize >= 20}
                    onClick={() =>
                      update({
                        editorFontSize: Math.min(20, state.editorFontSize + 1),
                      })
                    }
                  >
                    A+
                  </button>
                </div>
                <button onClick={resetCode} title="Limpar editor">
                  <RotateCcw /> Limpar
                </button>
                <button
                  type="button"
                  title="Atalhos de teclado"
                  onClick={() => setShortcutsOpen(true)}
                >
                  <Keyboard /> Atalhos
                </button>
              </details>
              <button
                title={editorExpanded ? "Reduzir editor" : "Expandir editor"}
                aria-label={
                  editorExpanded ? "Reduzir editor" : "Expandir editor"
                }
                aria-pressed={editorExpanded}
                onClick={() => setEditorExpanded((expanded) => !expanded)}
              >
                {editorExpanded ? <Minimize2 /> : <Maximize2 />}
              </button>
            </div>
          </div>
          <div className="editor-actions editor-actions-top">
            <span>
              {syntaxError?.kind === "syntax"
                ? "Há um erro de escrita para corrigir."
                : "Execute livremente ou envie para corrigir."}
            </span>
            <div>
              <button
                className="button button-secondary"
                onClick={runCode}
                disabled={running}
                title="Executar (Ctrl+Enter)"
              >
                <Play fill="currentColor" /> Executar
              </button>
              <button
                className="button button-primary"
                onClick={submitCode}
                disabled={running}
                title="Enviar resposta (Ctrl+Shift+Enter)"
              >
                <Send /> Enviar resposta
              </button>
            </div>
          </div>
          <details className={styles.secondary}>
            <summary>Versões e ferramentas</summary>
            <CodeVersionTools
              scope={activityMode === "project" ? "project" : "exercise"}
              sourceId={exercise.id}
              language={exercise.language ?? "javascript"}
              code={code}
              title={exercise.title}
              onCodeChange={setCode}
            />
          </details>
          {typingNotice && state.featureFlags.AI_TUTOR && (
            <button
              className="typing-analysis-notice"
              onClick={() => {
                setTutorOpen(true);
                setMobilePanel("tutor");
                void askTutor("analyze-logic");
              }}
            >
              <Bot />
              <span>
                <b>Tutor encontrou um possível problema</b>
                <small>{typingNotice} Clique para analisar.</small>
              </span>
              <ArrowRight />
            </button>
          )}
          {exercise.runExample && (
            <label className="runtime-input-row">
              <span>
                <Terminal />
                <b>{exercise.runExample.label}</b>
                <small>{exercise.runExample.help}</small>
              </span>
              <input
                aria-label={exercise.runExample.label}
                type={
                  exercise.runExample.inputKind === "number" ? "number" : "text"
                }
                value={runtimeInput}
                onChange={(event) => setRuntimeInput(event.target.value)}
                spellCheck={false}
              />
            </label>
          )}
          <div
            className="monaco-wrap"
            onBlurCapture={() => saveDraft(exercise.id, code)}
          >
            <MonacoEditor
              height="100%"
              language="javascript"
              theme={state.theme === "dark" ? "vs-dark" : "light"}
              value={code}
              onChange={(value) => setCode(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontFamily: "DM Mono, Consolas, monospace",
                fontSize: state.editorFontSize,
                lineHeight: Math.round(state.editorFontSize * 1.6),
                padding: { top: 18 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
                lineNumbersMinChars: 3,
                renderLineHighlight: "line",
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>
          <ResultsPanel
            running={running}
            tests={tests}
            result={consoleResult}
            pending={pendingValidation}
            status={resultStatus}
          />
          {activityMode !== "assessment" && (
            <details className={styles.secondary}>
              <summary>Avaliar ou reportar este exercício</summary>
              <FeedbackPanel
                exerciseId={exercise.id}
                alreadySent={state.exerciseFeedback.some(
                  (item) => item.exerciseId === exercise.id,
                )}
                onSubmit={submitExerciseFeedback}
              />
            </details>
          )}
        </section>

        {tutorOpen &&
          activityMode !== "assessment" &&
          state.featureFlags.AI_TUTOR && (
            <div
              id="exercise-tutor"
              className={styles.tutor}
              data-active={mobilePanel === "tutor"}
            >
              <TutorPanel
                messageFeedback={tutorFeedback}
                onMessageFeedback={(id, helpful) =>
                  setTutorFeedback((current) => ({ ...current, [id]: helpful }))
                }
                active={mobilePanel === "tutor"}
                onClose={() => {
                  setTutorOpen(false);
                  setMobilePanel("editor");
                  window.requestAnimationFrame(() =>
                    tutorToggle.current?.focus(),
                  );
                }}
                busy={tutorBusy}
                available={chat.available}
                mode={chat.mode}
                error={chat.error}
                notice={chat.notice}
                onRetry={() => void chat.retry()}
                onStop={chat.stop}
                messages={tutorMessages}
                attempts={exerciseAttempts}
                question={tutorQuestion}
                savedMessageIds={state.savedTutorExplanations.map(
                  (item) => item.messageId,
                )}
                onSaveMessage={(message) =>
                  saveTutorExplanation({
                    messageId: message.id,
                    sourceId: exercise.id,
                    title: exercise.title,
                    content: message.content,
                    concept: exercise.concept,
                  })
                }
                onQuestionChange={setTutorQuestion}
                onAsk={(intent) => askTutor(intent)}
                onSubmitQuestion={() => {
                  const question = tutorQuestion.trim();
                  if (!question) return;
                  void askTutor("question", { question });
                }}
              />
            </div>
          )}
      </div>
      {shortcutsOpen && (
        <div
          className="version-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Atalhos de teclado"
        >
          <section className="shortcuts-dialog">
            <button
              aria-label="Fechar atalhos"
              onClick={() => setShortcutsOpen(false)}
            >
              Fechar
            </button>
            <h2>Atalhos de teclado</h2>
            <p>Ctrl+Enter: executar no navegador</p>
            <p>Ctrl+Shift+Enter: enviar resposta ao servidor</p>
            <p>Alt+T: abrir Tutor</p>
            <p>Ctrl+Alt+F: expandir editor</p>
            <p>Esc: sair do modo foco</p>
          </section>
        </div>
      )}
    </div>
  );
}
