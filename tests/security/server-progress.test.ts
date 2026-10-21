import assert from "node:assert/strict";
import test from "node:test";
import { exercises } from "../../lib/content";
import { initialState } from "../../lib/initial-state";
import {
  applyOfficialProgress,
  emptyTrustedProgress,
} from "../../lib/trusted-progress";
import { assessSubmission } from "../../services/attempts/static-assessment";
import {
  transitionAttempt,
  transitionClaim,
} from "../../services/attempts/progress-transition";
import { PROJECT_CATALOG } from "../../lib/learning-program";
import { mergeProgressStates } from "../../services/sync/progress-sync";
import { synchronizeProgressState } from "../../lib/progress";
import { getBrasiliaDateKey } from "../../lib/daily-workouts";
import type { AppState, AttemptRecord } from "../../lib/types";

test("all approved catalog solutions match their official test specifications", () => {
  for (const exercise of exercises) {
    assert.equal(
      assessSubmission(exercise.solution, exercise).passed,
      true,
      exercise.id,
    );
    // These are repository-owned fixtures, never user submissions or production execution.
    for (const spec of exercise.tests) {
      const logs: string[] = [];
      const runFixture = new Function(
        "console",
        exercise.solution + `\nreturn (${spec.expression ?? "undefined"});`,
      );
      const received = runFixture({
        log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      });
      if (spec.expectedLogs)
        assert.ok(
          spec.expectedLogs.every((line) => logs.includes(line)),
          exercise.id,
        );
      else assert.deepEqual(received, spec.expected, exercise.id);
    }
  }
});
test("constant analysis accepts equivalent greetings and rejects incorrect values", () => {
  const exercise = exercises[0];
  assert.equal(
    assessSubmission(
      'const nome = "Ada"; console.log("Olá, " + nome + "!");',
      exercise,
    ).passed,
    true,
  );
  assert.equal(
    assessSubmission(
      'const nome = "Eve"; console.log(`Olá, ${nome}!`);',
      exercise,
    ).passed,
    false,
  );
  assert.equal(
    assessSubmission(
      'const nome = "Ada"; console.log(`Wrong ${nome}!`);',
      exercise,
    ).passed,
    false,
  );
});
test("submitted host access, prototype attacks, loops and unsupported alternatives are never executed or rewarded", () => {
  for (const code of [
    "process.exit(0)",
    "globalThis.__phase3_pwned = true",
    "while(true){}",
    "console.log.constructor('return process')()",
    "const nome = 'Ada'; fetch('https://example.test')",
    'using nome = "Ada"; console.log("Olá, " + nome + "!");',
    'const nome: string = "Ada"; console.log("Olá, " + nome + "!");',
    'const nome! = "Ada"; console.log("Olá, " + nome + "!");',
    'const future = typeof later; const later = "x"; const nome = "Ada"; console.log("Olá, " + nome + "!");',
    'const let = "x"; const nome = "Ada"; console.log("Olá, " + nome + "!");',
  ]) {
    const result = assessSubmission(code, exercises[0]);
    assert.equal(result.passed, false);
    assert.equal(result.status, "pending");
  }
  assert.equal(
    (globalThis as Record<string, unknown>).__phase3_pwned,
    undefined,
  );
  const functions = exercises.find((e) => e.id === "funcoes")!;
  assert.equal(
    assessSubmission(
      "function calcularDobro(numero) { return\n numero * 2; }",
      functions,
    ).passed,
    false,
  );
  assert.equal(assessSubmission("function {", functions).status, "failed");
});

function cleanState(): AppState {
  return {
    ...initialState,
    ...emptyTrustedProgress(),
    user: {
      ...initialState.user,
      accountId: "A",
      trainingStartedOn: getBrasiliaDateKey(),
    },
  };
}
function record(attemptNumber: number): AttemptRecord {
  return {
    id: `attempt-${attemptNumber}`,
    exerciseId: exercises[0].id,
    code: exercises[0].solution,
    createdAt: new Date().toISOString(),
    passed: true,
    passedTests: 3,
    failedTests: 0,
    testResults: [],
    hintsUsed: 0,
    tutorMessageIds: [],
    attemptNumber,
    activityMode: "path",
  };
}
test("official first completion awards 10 + 10 + 30 + 40 XP, repetitions cannot inflate XP or mastery", () => {
  const first = transitionAttempt(
    cleanState(),
    exercises[0],
    record(1),
    true,
    new Date(),
  );
  assert.equal(first.xp, 90); // 10 exercise + 10 no-hint + 30 challenge + 40 workout.
  assert.equal(first.level, 1);
  assert.equal(first.streak, 1);
  assert.deepEqual(first.completedExercises, [exercises[0].id]);
  const second = transitionAttempt(
    first,
    exercises[0],
    record(2),
    true,
    new Date(),
  );
  assert.equal(second.xp, first.xp);
  assert.deepEqual(second.userSkills, first.userSkills);
  assert.equal(second.attempts[exercises[0].id], 2);
});
test("pending assessments record attempts without completion, mastery, activity or XP", () => {
  const result = transitionAttempt(
    cleanState(),
    exercises[0],
    { ...record(1), passed: false },
    false,
    new Date(),
  );
  assert.equal(result.xp, 0);
  assert.deepEqual(result.completedExercises, []);
  assert.deepEqual(result.userSkills, {});
  assert.deepEqual(result.activeDays, []);
});

test("mission and project claims require official evidence and each grant is unique", () => {
  let state = cleanState();
  assert.equal(transitionClaim(state).xp, 0);
  assert.equal(transitionClaim(state, "calculadora").xp, 0);
  for (const exerciseId of [
    "primeiros-passos",
    "tipos-de-dados",
    "comparacoes",
  ]) {
    const exercise = exercises.find((e) => e.id === exerciseId)!;
    state = transitionAttempt(
      state,
      exercise,
      { ...record(1), id: exerciseId, exerciseId, code: exercise.solution },
      true,
      new Date(),
    );
  }
  const before = state.xp;
  state = transitionClaim(state);
  assert.equal(state.xp - before, 120);
  assert.equal(transitionClaim(state).xp, state.xp);
  const project = PROJECT_CATALOG[0];
  for (const step of project.steps) {
    const exercise = exercises.find((e) => e.id === step.exerciseId)!;
    state = transitionAttempt(
      state,
      exercise,
      {
        ...record(1),
        id: "project-" + step.exerciseId,
        exerciseId: step.exerciseId,
        code: exercise.solution,
        activityMode: "project",
        projectId: project.id,
      },
      true,
      new Date(),
    );
  }
  const projectBefore = state.xp;
  state = transitionClaim(state, project.id);
  assert.equal(state.xp - projectBefore, project.xpReward);
  assert.equal(transitionClaim(state, project.id).xp, state.xp);
});
test("browser reconciliation and generic merging cannot mint or import trusted rewards", () => {
  const clean = cleanState();
  const forged = {
    ...clean,
    xp: 9999,
    level: 20,
    completedExercises: [exercises[0].id],
    drafts: { private: "code" },
  };
  assert.deepEqual(synchronizeProgressState(forged).xpTransactions, []);
  const merged = mergeProgressStates(clean, forged);
  assert.equal(merged.xp, 0);
  assert.deepEqual(merged.completedExercises, []);
  const sanitized = applyOfficialProgress(forged, {
    ownerId: "A",
    revision: 0,
    trainingStartedOn: getBrasiliaDateKey(),
    progress: emptyTrustedProgress(),
  });
  assert.equal(sanitized.xp, 0);
  assert.equal(sanitized.drafts.private, "code");
  assert.throws(
    () =>
      applyOfficialProgress(forged, {
        ownerId: "B",
        revision: 1,
        trainingStartedOn: getBrasiliaDateKey(),
        progress: emptyTrustedProgress(),
      }),
    /owner/,
  );
});
