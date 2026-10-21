import type { ExerciseTest } from "@/lib/types";

export type ExecutionError = {
  kind: "syntax" | "runtime" | "timeout";
  message: string;
  line?: number;
};

export type ExecutionResult = {
  logs: string[];
  value?: unknown;
  error?: ExecutionError;
  durationMs: number;
  outputTruncated?: boolean;
};

export type TestResult = ExerciseTest & {
  passed: boolean;
  received?: unknown;
  error?: ExecutionError;
};

export type RunOptions = {
  expression?: string;
  input?: unknown;
};

export interface CodeRunner {
  run(code: string, options?: RunOptions): Promise<ExecutionResult>;
  test(code: string, tests: ExerciseTest[]): Promise<TestResult[]>;
}
