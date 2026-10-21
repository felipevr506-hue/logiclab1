"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clipboard,
  Clock3,
  Code2,
  Download,
  FileCode2,
  FolderKanban,
  History,
  Lightbulb,
  LoaderCircle,
  Play,
  RotateCcw,
  Sparkles,
  TerminalSquare,
  Trophy,
  XCircle,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { exercises } from "@/lib/content";
import { PROJECT_CATALOG } from "@/lib/learning-program";
import type { AttemptRecord } from "@/lib/types";
import { browserCodeRunner } from "@/services/code-runner/browser-runner";
import type { ExecutionResult } from "@/services/code-runner/types";
import { getProjectProgress } from "@/services/learning/learning-program";
import { EmptyState, ProgressBar } from "@/components/ui";

const MonacoEditor = dynamic(() => import("@/components/local-monaco-editor"), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      <LoaderCircle /> Preparando editor...
    </div>
  ),
});

const experiments = [
  {
    id: "variaveis",
    title: "Mude uma variável",
    concept: "Variáveis",
    instruction:
      "Troque o valor de pontos e execute novamente. Observe quais partes da saída mudam.",
    challenge: "Faça o bônus resultar em 35 pontos sem alterar a última linha.",
    code: 'let pontos = 10;\nconst bonus = 5;\nconsole.log("Antes:", pontos);\npontos = pontos + bonus;\nconsole.log("Depois:", pontos);',
  },
  {
    id: "condicoes",
    title: "Teste dois caminhos",
    concept: "Condições",
    instruction:
      "Altere a idade para valores abaixo e acima de 18. Compare qual bloco é executado.",
    challenge:
      "Inclua uma mensagem específica para quem tem exatamente 18 anos.",
    code: 'const idade = 16;\n\nif (idade >= 18) {\n  console.log("Acesso liberado");\n} else {\n  console.log("Acesso bloqueado");\n}',
  },
  {
    id: "loops",
    title: "Observe um loop",
    concept: "Loops e listas",
    instruction:
      "Adicione outro item à lista e acompanhe quantas vezes o bloco é executado.",
    challenge: "Mostre também a posição de cada linguagem, começando em 1.",
    code: 'const linguagens = ["JavaScript", "Python", "Java"];\n\nfor (const linguagem of linguagens) {\n  console.log("Treinar:", linguagem);\n}',
  },
] as const;

function readableOutput(result: ExecutionResult | null) {
  if (!result) return "Execute o exemplo para ver a saída.";
  if (result.error) return `${result.error.kind}: ${result.error.message}`;
  const values = [...result.logs];
  if (result.value !== undefined) {
    values.push(
      typeof result.value === "string"
        ? result.value
        : JSON.stringify(result.value),
    );
  }
  return values.join("\n") || "Execução concluída sem saída.";
}

export function LaboratoryPage() {
  const { state, saveDraft, recordCodeVersion } = useAppState();
  const [experimentId, setExperimentId] = useState<
    (typeof experiments)[number]["id"]
  >(experiments[0].id);
  const experiment = experiments.find((item) => item.id === experimentId)!;
  const sourceId = `laboratory:${experiment.id}`;
  const [code, setCode] = useState<string>(experiment.code);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCode(state.drafts[sourceId] ?? experiment.code);
      setResult(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [experiment.code, sourceId, state.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setTimeout(() => saveDraft(sourceId, code), 180);
    return () => window.clearTimeout(timer);
  }, [code, saveDraft, sourceId]);

  const run = async () => {
    setRunning(true);
    recordCodeVersion({
      scope: "playground",
      sourceId,
      language: "javascript",
      code,
      reason: "run",
    });
    setResult(await browserCodeRunner.run(code));
    setRunning(false);
  };

  return (
    <main className="standard-page laboratory-page">
      <header className="page-intro">
        <div>
          <span>EXPERIMENTE SEM MEDO</span>
          <h1>Laboratório</h1>
          <p>
            Altere exemplos curtos, execute de verdade e observe causa e efeito.
            Esta área salva seus rascunhos, mas não concede XP.
          </p>
        </div>
        <span className="service-status healthy">
          <i /> Executor JavaScript disponível
        </span>
      </header>

      <section className="laboratory-layout">
        <aside className="laboratory-experiments panel-card">
          <small>ESCOLHA UM EXPERIMENTO</small>
          {experiments.map((item, index) => (
            <button
              type="button"
              className={item.id === experiment.id ? "active" : ""}
              onClick={() => setExperimentId(item.id)}
              key={item.id}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <b>{item.title}</b>
                <small>{item.concept}</small>
              </div>
              <ArrowRight />
            </button>
          ))}
          <div className="laboratory-tip">
            <Lightbulb />
            <p>
              Aqui não existe resposta certa. Faça uma mudança por vez e compare
              a saída.
            </p>
          </div>
        </aside>

        <section className="laboratory-workspace">
          <div className="laboratory-task panel-card">
            <span>
              <Sparkles /> {experiment.concept}
            </span>
            <h2>{experiment.title}</h2>
            <p>{experiment.instruction}</p>
            <div>
              <b>Experimento sugerido</b>
              <p>{experiment.challenge}</p>
            </div>
          </div>

          <div className="laboratory-code panel-card">
            <header>
              <span>
                <Code2 /> exemplo.js
              </span>
              <div>
                <small>Salvo automaticamente</small>
                <button
                  type="button"
                  onClick={() => {
                    setCode(experiment.code);
                    setResult(null);
                  }}
                >
                  <RotateCcw /> Restaurar
                </button>
              </div>
            </header>
            <MonacoEditor
              height="360px"
              language="javascript"
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
            <footer>
              <button
                type="button"
                className="button button-primary"
                onClick={() => void run()}
                disabled={running || !state.hydrated}
              >
                {running ? <LoaderCircle /> : <Play />} Executar alteração
              </button>
            </footer>
          </div>

          <div className="laboratory-terminal panel-card">
            <header>
              <span>
                <TerminalSquare /> Terminal
              </span>
              {result && (
                <small>
                  {result.error ? "Falhou" : "Concluído"} ·{" "}
                  {Math.round(result.durationMs)} ms
                </small>
              )}
            </header>
            <pre aria-live="polite" className={result?.error ? "error" : ""}>
              {readableOutput(result)}
            </pre>
          </div>
        </section>
      </section>
    </main>
  );
}

type ErrorInsight = {
  id: string;
  title: string;
  detail: string;
  count: number;
};

function getErrorInsights(attempts: AttemptRecord[]): ErrorInsight[] {
  const syntax = attempts.filter(
    (attempt) => attempt.runtimeError?.kind === "syntax",
  ).length;
  const runtime = attempts.filter(
    (attempt) => attempt.runtimeError?.kind === "runtime",
  ).length;
  const timeout = attempts.filter(
    (attempt) => attempt.runtimeError?.kind === "timeout",
  ).length;
  const output = attempts.filter(
    (attempt) => !attempt.runtimeError && attempt.failedTests > 0,
  ).length;
  return [
    {
      id: "output",
      title: "Saída ou lógica incorreta",
      detail: "O programa executou, mas algum caso de teste divergiu.",
      count: output,
    },
    {
      id: "syntax",
      title: "Sintaxe",
      detail: "O interpretador não conseguiu compreender a escrita.",
      count: syntax,
    },
    {
      id: "runtime",
      title: "Execução",
      detail: "O código iniciou e encontrou um erro durante a execução.",
      count: runtime,
    },
    {
      id: "timeout",
      title: "Tempo excedido",
      detail: "A execução foi interrompida, geralmente por um loop infinito.",
      count: timeout,
    },
  ].toSorted((a, b) => b.count - a.count);
}

function attemptLabel(attempt: AttemptRecord) {
  if (attempt.passed) return "Solução correta";
  if (attempt.runtimeError?.kind === "syntax") return "Erro de sintaxe";
  if (attempt.runtimeError?.kind === "timeout") return "Tempo excedido";
  if (attempt.runtimeError) return "Erro de execução";
  return `${attempt.passedTests} teste${attempt.passedTests === 1 ? "" : "s"} aprovado${attempt.passedTests === 1 ? "" : "s"}`;
}

export function EvolutionPage() {
  const { state } = useAppState();
  const attempts = state.attemptHistory.toSorted((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const insights = getErrorInsights(attempts);
  const grouped = Object.values(
    attempts.reduce<Record<string, AttemptRecord[]>>((result, attempt) => {
      result[attempt.exerciseId] = [
        ...(result[attempt.exerciseId] ?? []),
        attempt,
      ];
      return result;
    }, {}),
  ).toSorted((a, b) => b.length - a.length);
  const evolution = grouped.find((group) => group.length > 1) ?? grouped[0];
  const firstAttempt = evolution?.[0];
  const lastAttempt = evolution?.at(-1);
  const solved = attempts.filter((attempt) => attempt.passed).length;
  const passedTests = attempts.reduce(
    (total, attempt) => total + attempt.passedTests,
    0,
  );
  const totalTests = attempts.reduce(
    (total, attempt) => total + attempt.passedTests + attempt.failedTests,
    0,
  );
  const accuracy = totalTests
    ? Math.round((passedTests / totalTests) * 100)
    : 0;

  return (
    <main className="standard-page evolution-page">
      <header className="page-intro">
        <div>
          <span>HISTÓRICO DE APRENDIZADO</span>
          <h1>Minha evolução</h1>
          <p>
            Compare tentativas, identifique erros recorrentes e veja como sua
            solução avançou. Todos os números vêm do histórico salvo.
          </p>
        </div>
        <Link href="/atividade" className="button button-secondary">
          <History /> Ver atividade completa
        </Link>
      </header>

      <section className="evolution-metrics">
        <article className="panel-card">
          <span>
            <Code2 />
          </span>
          <div>
            <small>TENTATIVAS</small>
            <b>{attempts.length}</b>
          </div>
        </article>
        <article className="panel-card">
          <span>
            <CheckCircle2 />
          </span>
          <div>
            <small>SOLUÇÕES CORRETAS</small>
            <b>{solved}</b>
          </div>
        </article>
        <article className="panel-card">
          <span>
            <BarChart3 />
          </span>
          <div>
            <small>TESTES APROVADOS</small>
            <b>{accuracy}%</b>
          </div>
        </article>
      </section>

      {attempts.length ? (
        <>
          <section className="error-insights-section panel-card">
            <header>
              <div>
                <small>PADRÕES REAIS</small>
                <h2>Erros que você mais comete</h2>
              </div>
              <p>
                A frequência orienta revisões; ela não reduz seu nível nem apaga
                conquistas.
              </p>
            </header>
            <div className="error-insights-grid">
              {insights.map((insight) => (
                <article
                  className={insight.count ? "has-errors" : ""}
                  key={insight.id}
                >
                  <span>
                    {insight.count ? <AlertTriangle /> : <CheckCircle2 />}
                  </span>
                  <div>
                    <b>{insight.title}</b>
                    <p>{insight.detail}</p>
                  </div>
                  <strong>{insight.count}</strong>
                </article>
              ))}
            </div>
          </section>

          {firstAttempt && lastAttempt && (
            <section className="code-evolution-section panel-card">
              <header>
                <div>
                  <small>ANTES E DEPOIS</small>
                  <h2>
                    {exercises.find(
                      (item) => item.id === firstAttempt.exerciseId,
                    )?.title ?? firstAttempt.exerciseId}
                  </h2>
                </div>
                <span>
                  {firstAttempt.passedTests} → {lastAttempt.passedTests} testes
                  aprovados
                </span>
              </header>
              <div className="code-comparison-grid">
                <article>
                  <div>
                    <span>Tentativa {firstAttempt.attemptNumber}</span>
                    <b>{attemptLabel(firstAttempt)}</b>
                  </div>
                  <pre>{firstAttempt.code}</pre>
                </article>
                <article>
                  <div>
                    <span>Tentativa {lastAttempt.attemptNumber}</span>
                    <b>{attemptLabel(lastAttempt)}</b>
                  </div>
                  <pre>{lastAttempt.code}</pre>
                </article>
              </div>
              <div className="evolution-recognition">
                <Sparkles />
                <p>
                  {lastAttempt.passedTests > firstAttempt.passedTests
                    ? `Você avançou ${lastAttempt.passedTests - firstAttempt.passedTests} caso(s) de teste entre essas tentativas.`
                    : lastAttempt.passed
                      ? "A solução mais recente passou por todos os casos de teste."
                      : "As versões foram preservadas para você comparar a estratégia, mesmo sem alteração na pontuação."}
                </p>
              </div>
            </section>
          )}

          <section className="attempt-replay-section panel-card">
            <header>
              <div>
                <small>REPLAY DA SOLUÇÃO</small>
                <h2>Da tentativa ao entendimento</h2>
              </div>
              <Link href="/praticar" className="button button-secondary">
                Praticar novamente <ArrowRight />
              </Link>
            </header>
            <div className="attempt-replay-list">
              {attempts
                .toReversed()
                .slice(0, 10)
                .map((attempt) => (
                  <article key={attempt.id}>
                    <span className={attempt.passed ? "passed" : "failed"}>
                      {attempt.passed ? <CheckCircle2 /> : <XCircle />}
                    </span>
                    <div>
                      <small>TENTATIVA {attempt.attemptNumber}</small>
                      <b>{attemptLabel(attempt)}</b>
                      <p>
                        {exercises.find(
                          (item) => item.id === attempt.exerciseId,
                        )?.title ?? attempt.exerciseId}
                      </p>
                    </div>
                    <time>
                      <Clock3 />
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      }).format(new Date(attempt.createdAt))}
                    </time>
                  </article>
                ))}
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="Sua evolução começará na primeira tentativa"
          text="Envie uma resposta no treino para registrar testes, erros, dicas e versões do código."
          action={
            <Link href="/dashboard" className="button button-primary">
              Ir para o treino de hoje <ArrowRight />
            </Link>
          }
        />
      )}
    </main>
  );
}

function downloadProjectCode(title: string, code: string) {
  const blob = new Blob([code], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}.js`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function PortfolioPage() {
  const { state } = useAppState();
  const [notice, setNotice] = useState("");
  const projects = useMemo(
    () =>
      PROJECT_CATALOG.map((definition) => {
        const progress = getProjectProgress(state, definition.id);
        const attempts = state.attemptHistory.filter(
          (attempt) =>
            attempt.activityMode === "project" &&
            attempt.projectId === definition.id &&
            attempt.passed,
        );
        return {
          ...progress,
          attempts,
          code: attempts.at(-1)?.code ?? "",
          completedAt: attempts.at(-1)?.createdAt,
          skills: [
            ...new Set(
              definition.steps.map(
                (step) =>
                  exercises.find((exercise) => exercise.id === step.exerciseId)
                    ?.concept ?? step.title,
              ),
            ),
          ],
        };
      }),
    [state],
  );
  const completed = projects.filter((project) => project.complete);

  if (!state.featureFlags.PORTFOLIO) {
    return (
      <section className="route-state">
        <FolderKanban />
        <h1>Portfólio temporariamente indisponível</h1>
        <p>O recurso foi desativado pela administração.</p>
      </section>
    );
  }

  return (
    <main className="standard-page portfolio-page">
      <header className="page-intro">
        <div>
          <span>EVIDÊNCIAS DE PRÁTICA</span>
          <h1>Meu portfólio</h1>
          <p>
            Projetos concluídos com linguagem, habilidades, data e código final.
            Esta área demonstra prática; não representa certificado oficial.
          </p>
        </div>
        <span className="portfolio-count">
          <Trophy /> {completed.length} projeto
          {completed.length === 1 ? "" : "s"}
        </span>
      </header>

      {notice && (
        <div className="inline-success" role="status">
          <CheckCircle2 /> {notice}
        </div>
      )}

      {completed.length ? (
        <section className="portfolio-grid">
          {completed.map((project) => (
            <article className="portfolio-project panel-card" key={project.id}>
              <header>
                <span>
                  <FileCode2 />
                </span>
                <div>
                  <small>JAVASCRIPT · PROJETO CONCLUÍDO</small>
                  <h2>{project.title}</h2>
                </div>
                <CheckCircle2 />
              </header>
              <p>{project.description}</p>
              <div className="portfolio-meta">
                <span>
                  <Code2 /> {project.language}
                </span>
                <span>
                  <Clock3 />
                  {project.completedAt
                    ? new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                        timeZone: "America/Sao_Paulo",
                      }).format(new Date(project.completedAt))
                    : "Data não registrada"}
                </span>
              </div>
              <div className="portfolio-skills">
                <small>HABILIDADES APLICADAS</small>
                <div>
                  {project.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </div>
              <div className="portfolio-progress">
                <span>
                  Etapas verificadas{" "}
                  <b>
                    {project.steps.length}/{project.steps.length}
                  </b>
                </span>
                <ProgressBar value={100} />
              </div>
              {project.code && (
                <details>
                  <summary>Ver código final</summary>
                  <pre>{project.code}</pre>
                </details>
              )}
              <footer>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!project.code}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(project.code)
                      .then(() =>
                        setNotice(`Código de ${project.title} copiado.`),
                      );
                  }}
                >
                  <Clipboard /> Copiar
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={!project.code}
                  onClick={() =>
                    downloadProjectCode(project.title, project.code)
                  }
                >
                  <Download /> Baixar código
                </button>
              </footer>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="Seu primeiro projeto aparecerá aqui"
          text="Conclua todas as etapas verificadas de um projeto para adicioná-lo ao portfólio."
          action={
            <Link href="/projetos" className="button button-primary">
              Ver projetos disponíveis <ArrowRight />
            </Link>
          }
        />
      )}
    </main>
  );
}
