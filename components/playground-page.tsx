"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Code2,
  LoaderCircle,
  Play,
  RotateCcw,
  Send,
  Terminal,
  Trash2,
} from "lucide-react";
import { CodeVersionTools } from "@/components/code-version-tools";
import { useAppState } from "@/lib/app-state";
import type { ProgrammingLanguageId } from "@/lib/types";
import { tutorService } from "@/services/ai/tutor";
import { browserCodeRunner } from "@/services/code-runner/browser-runner";
import type { ExecutionResult } from "@/services/code-runner/types";

const MonacoEditor = dynamic(() => import("@/components/local-monaco-editor"), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      <LoaderCircle /> Preparando editor...
    </div>
  ),
});

const languageNames: Record<ProgrammingLanguageId, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
};

const starterCode: Record<ProgrammingLanguageId, string> = {
  javascript:
    'const nome = prompt("Qual é o seu nome?");\nconsole.log(`Olá, ${nome}!`);',
  python: 'nome = input("Qual é o seu nome? ")\nprint(f"Olá, {nome}!")',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Olá!");\n  }\n}',
  c: '#include <stdio.h>\n\nint main(void) {\n  printf("Olá!\\n");\n  return 0;\n}',
  cpp: '#include <iostream>\n\nint main() {\n  std::cout << "Olá!" << std::endl;\n  return 0;\n}',
};

export function PlaygroundPage() {
  const { state, saveDraft, recordCodeVersion, recordTutorMessages } =
    useAppState();
  const availableLanguages = useMemo(
    () => state.userLanguages.map((item) => item.languageId),
    [state.userLanguages],
  );
  const [language, setLanguage] = useState<ProgrammingLanguageId>("javascript");
  const sourceId = `playground:${language}`;
  const [code, setCode] = useState(
    state.drafts[sourceId] ?? starterCode[language],
  );
  const [stdin, setStdin] = useState("Ada");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [question, setQuestion] = useState("");
  const [tutorReply, setTutorReply] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCode(state.drafts[sourceId] ?? starterCode[language]);
      setResult(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [language, sourceId, state.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft(sourceId, code), 180);
    return () => window.clearTimeout(timer);
  }, [code, saveDraft, sourceId]);

  const run = async () => {
    recordCodeVersion({
      scope: "playground",
      sourceId,
      language,
      code,
      reason: "run",
    });
    if (language !== "javascript") {
      setResult({
        logs: [],
        durationMs: 0,
        error: {
          kind: "runtime",
          message: `${languageNames[language]} pode ser editado e salvo, mas o executor seguro desta instalação ainda está disponível somente para JavaScript.`,
        },
      });
      return;
    }
    setRunning(true);
    setResult(await browserCodeRunner.run(code, { input: stdin }));
    setRunning(false);
  };

  const askTutor = async () => {
    const prompt = question.trim();
    if (!prompt) return;
    setTutorBusy(true);
    const reply = await tutorService.guide({
      exerciseId: sourceId,
      title: "Playground livre",
      description: "Explorar uma ideia de programação livremente.",
      concept: "lógica livre",
      language,
      skillMastery: 0,
      recentHistory: [],
      studentCode: code,
      expectedBehavior: "o comportamento descrito pelo aluno",
      tests: [],
      testResults: [],
      runtimeError: result?.error,
      attemptNumber: 1,
      hintsUsed: 0,
      progressiveHints: [
        "Separe a entrada, o processamento e a saída.",
        "Execute uma parte de cada vez.",
      ],
      solution: "",
      intent: "question",
      question: prompt,
    });
    recordTutorMessages(sourceId, [
      { role: "student", content: prompt },
      { role: "tutor", content: reply.message, helpLevel: reply.helpLevel },
    ]);
    setTutorReply(reply.message);
    setQuestion("");
    setTutorBusy(false);
  };

  if (!state.featureFlags.PLAYGROUND) {
    return (
      <section className="route-state">
        <span>
          <Code2 />
        </span>
        <h1>Playground temporariamente indisponível</h1>
        <p>O recurso foi desativado pela administração.</p>
      </section>
    );
  }

  return (
    <main className="standard-page playground-page">
      <header className="page-intro">
        <div>
          <span>LABORATÓRIO SEM XP</span>
          <h1>Playground livre</h1>
          <p>
            Escreva, execute, importe e versione suas ideias. Esta área não
            altera XP, sequência, missões ou exercícios concluídos.
          </p>
        </div>
        <label className="playground-language">
          Linguagem
          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as ProgrammingLanguageId)
            }
          >
            {(Object.keys(languageNames) as ProgrammingLanguageId[]).map(
              (item) => (
                <option
                  value={item}
                  key={item}
                  disabled={!availableLanguages.includes(item)}
                >
                  {languageNames[item]}
                  {!availableLanguages.includes(item) ? " — bloqueada" : ""}
                </option>
              ),
            )}
          </select>
        </label>
      </header>

      <section className="playground-grid">
        <div className="playground-editor">
          <header>
            <b>main.{language === "javascript" ? "js" : language}</b>
            <div>
              <span>Rascunho salvo automaticamente</span>
              <button
                type="button"
                title="Limpar editor"
                onClick={() => {
                  recordCodeVersion({
                    scope: "playground",
                    sourceId,
                    language,
                    code,
                    reason: "manual",
                  });
                  setCode("");
                }}
              >
                <Trash2 /> Limpar
              </button>
              <button
                type="button"
                title="Restaurar exemplo inicial"
                onClick={() => {
                  recordCodeVersion({
                    scope: "playground",
                    sourceId,
                    language,
                    code,
                    reason: "manual",
                  });
                  setCode(starterCode[language]);
                  setResult(null);
                }}
              >
                <RotateCcw /> Resetar
              </button>
            </div>
          </header>
          <CodeVersionTools
            scope="playground"
            sourceId={sourceId}
            language={language}
            code={code}
            title={`Playground ${languageNames[language]}`}
            onCodeChange={setCode}
          />
          <MonacoEditor
            height="440px"
            language={language === "cpp" ? "cpp" : language}
            value={code}
            onChange={(value) => setCode(value ?? "")}
            theme={state.theme === "dark" ? "vs-dark" : "light"}
            options={{
              fontSize: state.editorFontSize,
              minimap: { enabled: false },
              automaticLayout: true,
              wordWrap: "on",
            }}
          />
        </div>

        <aside className="playground-side">
          <section className="playground-console">
            <header>
              <Terminal /> <b>Console</b>
            </header>
            <label>
              Entrada padrão
              <textarea
                value={stdin}
                onChange={(event) => setStdin(event.target.value)}
                placeholder="Texto devolvido por prompt()"
              />
            </label>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void run()}
              disabled={running || !state.hydrated}
            >
              {running ? <LoaderCircle /> : <Play />} Executar
            </button>
            <pre aria-live="polite">
              {result?.error
                ? `Erro: ${result.error.message}`
                : result
                  ? [...result.logs, result.value].filter(Boolean).join("\n") ||
                    "Execução concluída sem saída."
                  : "A saída aparecerá aqui."}
            </pre>
          </section>

          <section className="playground-tutor">
            <header>
              <Bot />
              <span>
                <b>Tutor socrático local</b>
                <small>Considera o código e o último erro</small>
              </span>
            </header>
            {tutorReply && <p>{tutorReply}</p>}
            {tutorBusy && (
              <div
                className="tutor-thinking-bubble"
                aria-label="Tutor pensando"
              >
                <span /> <span /> <span />
              </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void askTutor();
              }}
            >
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Pergunte sobre esta ideia..."
              />
              <button
                className="button button-secondary"
                disabled={!question.trim() || tutorBusy}
              >
                <Send /> Perguntar
              </button>
            </form>
          </section>
        </aside>
      </section>
    </main>
  );
}
