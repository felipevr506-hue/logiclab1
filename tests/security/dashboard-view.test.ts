import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardView } from "../../lib/dashboard-view";
import { initialState } from "../../lib/initial-state";
import { dailyWorkouts } from "../../lib/daily-workouts";
import type { AttemptRecord } from "../../lib/types";

function state() {
  const value = structuredClone(initialState);
  value.user.trainingStartedOn = "2026-10-01";
  return value;
}
const day = (number: number) =>
  new Date(`2026-10-${String(number).padStart(2, "0")}T15:00:00Z`);
function attempt(
  exerciseId: string,
  createdAt: string,
  activityMode: AttemptRecord["activityMode"] = "path",
) {
  return {
    exerciseId,
    createdAt,
    activityMode,
    passed: false,
  } as AttemptRecord;
}
test("a new account starts at the first lesson, not the daily rotation or a local draft", () => {
  const value = state();
  value.drafts[dailyWorkouts[5].exerciseId] = "a local draft";
  const view = getDashboardView(value, day(5));
  assert.equal(view.action, "Começar minha primeira aula");
  assert.equal(view.href, `/treino/${dailyWorkouts[0].exerciseId}`);
  assert.equal(view.metrics.xp, 0);
  assert.equal(view.metrics.completedCount, 0);
  assert.equal(view.metrics.streak, 0);
});
test("continuation resumes the latest unfinished official path attempt, ignoring newer practice attempts", () => {
  const value = state();
  value.completedExercises = [dailyWorkouts[0].exerciseId];
  value.attemptHistory = [
    attempt(dailyWorkouts[2].exerciseId, day(3).toISOString()),
    attempt(dailyWorkouts[1].exerciseId, day(4).toISOString()),
    attempt(dailyWorkouts[4].exerciseId, day(5).toISOString(), "practice"),
  ];
  assert.equal(
    getDashboardView(value, day(5)).href,
    `/treino/${dailyWorkouts[1].exerciseId}`,
  );
  assert.equal(
    getDashboardView(value, day(5)).action,
    "Continuar de onde parei",
  );
});
test("completed exercises are skipped and future lessons never become the primary destination", () => {
  const value = state();
  value.completedExercises = [dailyWorkouts[0].exerciseId];
  value.attemptHistory = [
    attempt(dailyWorkouts[8].exerciseId, day(1).toISOString()),
  ];
  const waiting = getDashboardView(value, day(1));
  assert.equal(waiting.href, "/trilha");
  assert.equal(waiting.nextRelease?.exerciseId, dailyWorkouts[1].exerciseId);
  assert.equal(waiting.next, undefined);
  assert.equal(
    getDashboardView(value, day(2)).href,
    `/treino/${dailyWorkouts[1].exerciseId}`,
  );
});
test("a fully completed path offers practice without changing official state", () => {
  const value = state();
  value.completedExercises = dailyWorkouts.map((workout) => workout.exerciseId);
  const before = JSON.stringify(value);
  const view = getDashboardView(value, day(25));
  assert.equal(view.allCompleted, true);
  assert.equal(view.href, "/praticar");
  assert.equal(JSON.stringify(value), before);
});
