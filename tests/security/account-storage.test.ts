import assert from "node:assert/strict";
import test from "node:test";
import {
  accountStorageKey,
  ownsProgress,
  trainingDatabaseName,
} from "../../lib/account-storage";
import {
  loadRemoteProgress,
  mergeProgressStates,
  saveRemoteProgress,
} from "../../services/sync/progress-sync";
import type { AppState } from "../../lib/types";

test("both browser stores require an owner and separate account IDs", () => {
  assert.notEqual(accountStorageKey("A"), accountStorageKey("B"));
  assert.notEqual(trainingDatabaseName("A"), trainingDatabaseName("B"));
  assert.throws(() => accountStorageKey(""));
  assert.throws(() => trainingDatabaseName(""));
});

test("legacy or foreign browser state is never claimed by the current user", () => {
  const account = {
    id: "A",
    name: "A",
    email: "a@example.test",
    role: "STUDENT",
    plan: "FREE",
  } as const;
  assert.equal(ownsProgress({}, account), false);
  assert.equal(
    ownsProgress({ user: { accountId: "B" } } as Partial<AppState>, account),
    false,
  );
  assert.equal(
    ownsProgress(
      {
        user: { accountId: "A", email: "old-address@example.test" },
      } as Partial<AppState>,
      account,
    ),
    true,
  );
});

test("merging rejects different account IDs even if email addresses match", () => {
  const a = {
    user: { accountId: "A", email: "same@example.test" },
  } as AppState;
  const b = {
    user: { accountId: "B", email: "same@example.test" },
  } as AppState;
  assert.throws(() => mergeProgressStates(a, b), /different accounts/);
  assert.throws(
    () => mergeProgressStates(a, { user: { email: a.user.email } } as AppState),
    /different accounts/,
  );
});

test("remote load rejects a response for another owner", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({ ownerId: "B", snapshot: null });
    await assert.rejects(
      loadRemoteProgress("a@example.test", "A"),
      /owner mismatch/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("remote save rejects foreign snapshots and sends the original owner", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).ownerId, "A");
      return Response.json({
        ownerId: "A",
        snapshot: {
          revision: 1,
          state: { user: { accountId: "B", email: "a@example.test" } },
        },
      });
    };
    await assert.rejects(
      saveRemoteProgress("a@example.test", 0, {} as AppState, "A"),
      /owner mismatch/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
