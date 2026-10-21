import { CheckCircle2, XCircle } from "lucide-react";
import type { ExecutionResult, TestResult } from "@/services/code-runner/types";
export function RunFeedback({ result }: { result: ExecutionResult }) {
  if (result.error)
    return (
      <div className={`execution-error error-${result.error.kind}`}>
        <XCircle />
        <div>
          <b>
            {result.error.kind === "syntax"
              ? "Erro de sintaxe"
              : result.error.kind === "timeout"
                ? "Execução interrompida"
                : "Erro durante a execução"}
          </b>
          <p>
            {result.error.message}
            {result.error.line
              ? ` · linha aproximada ${result.error.line}`
              : ""}
          </p>
          <small>
            {result.error.kind === "syntax"
              ? "Seu raciocínio pode estar correto; revise a forma como o código foi escrito."
              : "Leia a mensagem e confira os valores usados nessa linha."}
          </small>
        </div>
      </div>
    );
  return (
    <div className="run-result">
      <div className="console-lines">
        {result.logs.map((line, index) => (
          <code key={`${line}-${index}`}>
            <span>{index + 1}</span>
            {line}
          </code>
        ))}
        {typeof result.value !== "undefined" && (
          <code className="returned-value">
            <span>→</span>
            Resultado: {formatOutput(result.value)}
          </code>
        )}
        {!result.logs.length && typeof result.value === "undefined" && (
          <p>O código executou sem imprimir mensagens no console.</p>
        )}
      </div>
      <small>
        Executado em {Math.max(1, Math.round(result.durationMs))} ms
      </small>
    </div>
  );
}

function formatOutput(value: unknown) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function TestFeedback({
  tests,
  status,
}: {
  tests: TestResult[];
  status: string | null;
}) {
  const passed = tests.filter((test) => test.passed).length;
  const error = tests.find((test) => test.error)?.error;
  return (
    <div className={`test-feedback status-${status}`}>
      <div className="feedback-summary">
        {status === "success" ? <CheckCircle2 /> : <XCircle />}
        <div>
          <b>
            {status === "success"
              ? "Todos os testes passaram!"
              : status === "syntax"
                ? "Encontramos um erro de sintaxe"
                : `${passed} de ${tests.length} testes passaram`}
          </b>
          <p>
            {status === "success"
              ? "Seu raciocínio funcionou nos diferentes cenários."
              : status === "syntax"
                ? "O JavaScript não conseguiu interpretar uma parte do código."
                : "Seu programa executa, mas ainda falha em alguns cenários."}
          </p>
        </div>
      </div>
      {error && (
        <div className="friendly-error">
          <code>{error.message}</code>
          <p>
            {error.kind === "syntax"
              ? "Revise parênteses, chaves, aspas e a linha indicada pelo editor."
              : error.message}
          </p>
        </div>
      )}
      <div className="test-result-list">
        {tests.map((test) => (
          <div key={test.id} className={test.passed ? "passed" : "failed"}>
            {test.passed ? <CheckCircle2 /> : <XCircle />}
            <span>
              <b>{test.label}</b>
              {!test.passed && !test.error && <small>{test.feedback}</small>}
            </span>
            <em>{test.passed ? "Passou" : "Rever"}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
