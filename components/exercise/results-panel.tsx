"use client";

import { useEffect, useRef } from "react";
import type { ExecutionResult, TestResult } from "@/services/code-runner/types";
import { RunFeedback, TestFeedback } from "./result-details";
import styles from "./workspace.module.css";

export function ResultsPanel({
  running,
  tests,
  result,
  pending,
  status,
}: {
  running: boolean;
  tests: TestResult[] | null;
  result: ExecutionResult | null;
  pending: string | null;
  status: string | null;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (
      !running &&
      (tests || result || pending) &&
      window.matchMedia("(max-width: 820px)").matches
    ) {
      panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [running, tests, result, pending]);
  const failed = tests?.find((test) => !test.passed);
  const title = running
    ? "Aguarde…"
    : pending
      ? "Validação pendente no servidor"
      : tests?.length
        ? tests.every((test) => test.passed)
          ? "Passou · resposta aprovada"
          : tests.some((test) => test.error)
            ? "Erro na validação"
            : "Falhou · revise este comportamento"
        : result?.error
          ? "Erro de execução ou envio"
          : result
            ? "Execução local concluída"
            : "Resultado";
  return (
    <section
      ref={panel}
      className={styles.results}
      aria-label="Resultado da execução"
      aria-live="polite"
      aria-busy={running}
    >
      <h2>{title}</h2>
      {!running && (
        <>
          {pending ? (
            <p>{pending} Nenhuma recompensa foi concedida por esta resposta.</p>
          ) : failed ? (
            <p>
              {failed.label}. {failed.feedback}
            </p>
          ) : result?.error ? (
            <p>{result.error.message}</p>
          ) : tests?.length ? (
            <p>Avaliação oficial registrada no servidor.</p>
          ) : result ? (
            <p>
              Esta prévia não concede XP. Use Enviar resposta para avaliação
              oficial.
            </p>
          ) : (
            <p>Execute para experimentar ou envie sua resposta para avaliar.</p>
          )}
          {!pending && (result || tests?.length) && (
            <details className={styles.secondary}>
              <summary>Testes, console e detalhes</summary>
              {tests?.length ? (
                <TestFeedback tests={tests} status={status} />
              ) : (
                result && <RunFeedback result={result} />
              )}
            </details>
          )}
        </>
      )}
    </section>
  );
}
