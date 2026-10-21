import type { ExerciseTest } from "@/lib/types";
import type {
  CodeRunner,
  ExecutionResult,
  RunOptions,
  TestResult,
} from "@/services/code-runner/types";

const configuredTimeout = Number(
  process.env.NEXT_PUBLIC_EXECUTION_TIMEOUT_MS ?? 1800,
);
const TIMEOUT_MS = Math.min(5_000, Math.max(500, configuredTimeout));
const MAX_CODE_CHARS = 50_000;
const MAX_INPUT_CHARS = 10_000;
const MAX_OUTPUT_LINES = 500;
const MAX_OUTPUT_CHARS = 50_000;
const BROWSER_EXECUTOR_ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_BROWSER_EXECUTOR_ENABLED === "true";

const workerSource = String.raw`
const readable = (value) => {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
};

self.fetch = undefined;
self.XMLHttpRequest = undefined;
self.WebSocket = undefined;

self.onmessage = async ({ data }) => {
  const started = performance.now();
  const logs = [];
  let outputChars = 0;
  let outputTruncated = false;
  const append = (line) => {
    outputChars += line.length;
    if (logs.length >= data.maxOutputLines || outputChars > data.maxOutputChars) {
      outputTruncated = true;
      throw new Error("__LOGICLAB_OUTPUT_LIMIT__");
    }
    logs.push(line);
  };
  const safeConsole = {
    log: (...values) => append(values.map(readable).join(" ")),
    info: (...values) => append(values.map(readable).join(" ")),
    warn: (...values) => append("Aviso: " + values.map(readable).join(" ")),
    error: (...values) => append("Erro: " + values.map(readable).join(" ")),
  };

  try {
    const tail = data.expression ? "\nreturn (" + data.expression + ");" : "";
    const prompt = () => typeof data.input === "string" ? data.input : readable(data.input);
    const execute = new Function("console", "input", "prompt", "fetch", "XMLHttpRequest", "WebSocket", data.code + tail);
    const value = await execute(safeConsole, data.input, prompt, undefined, undefined, undefined);
    self.postMessage({ logs, value, outputTruncated, durationMs: performance.now() - started });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage === "__LOGICLAB_OUTPUT_LIMIT__"
      ? "Saída muito grande. Parte do resultado foi ocultada."
      : rawMessage;
    const stack = error instanceof Error ? error.stack || "" : "";
    const match = stack.match(/<anonymous>:(\d+):(\d+)/);
    self.postMessage({
      logs,
      durationMs: performance.now() - started,
      outputTruncated,
      error: {
        kind: error instanceof SyntaxError ? "syntax" : "runtime",
        message,
        line: match ? Math.max(1, Number(match[1]) - 2) : undefined,
      },
    });
  }
};
`;

const equal = (received: unknown, expected: unknown) =>
  JSON.stringify(received) === JSON.stringify(expected);

function executeInWorker(
  code: string,
  expression?: string,
  input?: unknown,
): Promise<ExecutionResult> {
  if (!BROWSER_EXECUTOR_ENABLED) {
    return Promise.resolve({
      logs: [],
      durationMs: 0,
      error: {
        kind: "runtime",
        message:
          "ExecuÃ§Ã£o indisponÃ­vel neste ambiente: conecte um sandbox externo isolado para executar cÃ³digo nÃ£o confiÃ¡vel.",
      },
    });
  }
  if (code.length > MAX_CODE_CHARS) {
    return Promise.resolve({
      logs: [],
      durationMs: 0,
      error: {
        kind: "runtime",
        message: "O código ultrapassa o limite de 50 mil caracteres.",
      },
    });
  }
  const serializedInput =
    typeof input === "string"
      ? input
      : input === undefined
        ? ""
        : JSON.stringify(input);
  if (serializedInput.length > MAX_INPUT_CHARS) {
    return Promise.resolve({
      logs: [],
      durationMs: 0,
      error: {
        kind: "runtime",
        message: "A entrada ultrapassa o limite de 10 mil caracteres.",
      },
    });
  }
  return new Promise((resolve) => {
    const blob = new Blob([workerSource], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const started = performance.now();

    const finish = (result: ExecutionResult) => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = window.setTimeout(() => {
      finish({
        logs: [],
        durationMs: performance.now() - started,
        error: {
          kind: "timeout",
          message:
            "A execução levou tempo demais. Verifique se existe um loop infinito.",
        },
      });
    }, TIMEOUT_MS);

    worker.onmessage = ({ data }: MessageEvent<ExecutionResult>) => {
      window.clearTimeout(timer);
      finish(data);
    };

    worker.onerror = () => {
      window.clearTimeout(timer);
      finish({
        logs: [],
        durationMs: performance.now() - started,
        error: {
          kind: "runtime",
          message: "Não foi possível executar o código neste navegador.",
        },
      });
    };

    worker.postMessage({
      code,
      expression,
      input,
      maxOutputLines: MAX_OUTPUT_LINES,
      maxOutputChars: MAX_OUTPUT_CHARS,
    });
  });
}

export const browserCodeRunner: CodeRunner = {
  run(code: string, options?: RunOptions) {
    return executeInWorker(code, options?.expression, options?.input);
  },

  async test(code: string, tests: ExerciseTest[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const test of tests) {
      const execution = await executeInWorker(code, test.expression);
      const passed =
        !execution.error &&
        (test.expectedLogs
          ? test.expectedLogs.every((line) => execution.logs.includes(line))
          : equal(execution.value, test.expected));
      results.push({
        ...test,
        passed,
        received: test.expectedLogs ? execution.logs : execution.value,
        error: execution.error,
      });
      if (execution.error?.kind === "syntax") break;
    }
    return results;
  },
};
