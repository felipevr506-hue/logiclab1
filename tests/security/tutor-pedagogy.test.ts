import assert from "node:assert/strict";
import test from "node:test";
import { exercises } from "../../lib/content";
import {
  SocraticFallbackTutor,
  type TutorContext,
} from "../../services/ai/tutor";

test("local Tutor never releases the reference answer, even after all hints and many attempts", async () => {
  for (const exercise of exercises) {
    for (const attemptNumber of [0, 3, 20]) {
      const context: TutorContext = {
        exerciseId: exercise.id,
        title: exercise.title,
        description: exercise.objective,
        concept: exercise.concept,
        language: exercise.language ?? "javascript",
        skillMastery: 0,
        recentHistory: [],
        studentCode: exercise.starterCode,
        expectedBehavior: exercise.instructions.join(" "),
        tests: exercise.tests,
        testResults: [],
        attemptNumber,
        hintsUsed: exercise.hints.length,
        progressiveHints: exercise.hints,
        solution: "REFERENCE_ANSWER_MUST_NEVER_BE_RETURNED",
        intent: "request-solution",
      };
      const reply = await new SocraticFallbackTutor().guide(context);
      assert.ok(reply.helpLevel < 5);
      assert.ok(!reply.message.includes(context.solution));
      assert.match(reply.message, /pistas/);
    }
  }
});
