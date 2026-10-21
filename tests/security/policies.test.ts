import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  authMode,
  getDevelopmentPrincipal,
  validatePassword,
} from "../../services/auth/auth-store";
import {
  BillingNotConfiguredError,
  mapHotmartEventStatus,
  verifyHotmartWebhook,
} from "../../services/payments/billing-service";
import { getPlan } from "../../services/payments/plans";
import { hasEntitlement } from "../../services/entitlements/entitlements";
import { isTrustedMutation } from "../../services/security/request-guard";
import {
  InvalidProgressError,
  sanitizeProgressBackup,
} from "../../services/sync/progress-policy";

function withEnvironment(
  values: Record<string, string | undefined>,
  run: () => void,
) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("production forces authentication even when AUTH_MODE asks for demo", () => {
  withEnvironment({ APP_ENV: "production", AUTH_MODE: "demo" }, () => {
    assert.equal(authMode(), "required");
    assert.equal(getDevelopmentPrincipal(), null);
  });
});

test("development and test require authentication unless demo is explicit", () => {
  for (const appEnvironment of ["development", "test"]) {
    for (const mode of [undefined, "", "required", "unknown"]) {
      withEnvironment(
        { APP_ENV: appEnvironment, NODE_ENV: "development", AUTH_MODE: mode },
        () => {
          assert.equal(authMode(), "required");
          assert.equal(getDevelopmentPrincipal(), null);
        },
      );
    }
    withEnvironment(
      { APP_ENV: appEnvironment, NODE_ENV: "development", AUTH_MODE: "demo" },
      () => {
        assert.equal(authMode(), "demo");
        assert.ok(getDevelopmentPrincipal());
      },
    );
  }
});

test("cross-origin mutations are rejected against the configured origin", () => {
  withEnvironment(
    { APP_ENV: "production", NEXT_PUBLIC_APP_URL: "https://logiclab.example" },
    () => {
      const request = new NextRequest("https://logiclab.example/api/progress", {
        method: "PUT",
        headers: {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
          "x-logiclab-request": "same-origin",
        },
      });
      assert.equal(isTrustedMutation(request), false);
    },
  );
});

test("browser backups cannot grant plan, role, XP, level, skills or languages", async () => {
  const untrusted = {
    hydrated: true,
    user: {
      name: "Atacante",
      email: "attacker@example.test",
      avatar: "",
      goal: "",
      dailyMinutes: 30,
      experience: "",
      onboarded: true,
      plan: "pro",
      role: "admin",
      trainingStartedOn: "2000-01-01",
    },
    xp: 999999,
    level: 99,
    streak: 999,
    longestStreak: 999,
    activeDays: ["2000-01-01"],
    completedExercises: ["all"],
    attempts: { all: 1 },
    attemptHistory: [{ passed: true }],
    hintsUsed: {},
    tutorMessages: {},
    drafts: {},
    favorites: [],
    notes: {},
    theme: "dark",
    interfaceSize: "standard",
    editorFontSize: 16,
    xpTransactions: [{ amount: 999999 }],
    rewardGrants: [{ rewardId: "admin" }],
    userLanguages: [
      { languageId: "cpp", unlockedAt: "2000-01-01", unlockedBy: "plan" },
    ],
    primaryLanguage: "cpp",
    userSkills: { loops: { masteryScore: 1 } },
    helpTokens: 999,
    codeVersions: [],
    savedTutorExplanations: [],
    savedCodeSnippets: [],
    favoriteProjects: [],
    favoriteConcepts: [],
    exerciseFeedback: [],
    reducedMotion: false,
    notificationPreferences: {
      dailyTraining: true,
      reviews: true,
      achievements: true,
      weeklyGoal: true,
      importantUpdates: true,
    },
    featureFlags: {},
    editorOnboarded: true,
    tutorOnboarded: true,
    progressionOnboarded: true,
  };
  const sanitized = await sanitizeProgressBackup(untrusted, {
    name: "Aluno real",
    email: "aluno@example.test",
    role: "STUDENT",
    plan: "FREE",
  });
  assert.equal(sanitized.user.role, "student");
  assert.equal(sanitized.user.plan, "free");
  assert.equal(sanitized.user.email, "aluno@example.test");
  assert.equal(sanitized.xp, 0);
  assert.equal(sanitized.level, 1);
  assert.deepEqual(sanitized.completedExercises, []);
  assert.deepEqual(sanitized.xpTransactions, []);
  assert.deepEqual(sanitized.userSkills, {});
  assert.deepEqual(
    sanitized.userLanguages.map((item) => item.languageId),
    ["javascript"],
  );
});

test("backup rejects prototype-pollution keys", async () => {
  const payload = JSON.parse(
    '{"user":{},"drafts":{},"codeVersions":[],"savedCodeSnippets":[],"savedTutorExplanations":[],"notificationPreferences":{},"__proto__":{}}',
  );
  await assert.rejects(
    sanitizeProgressBackup(payload, {
      name: "Aluno",
      email: "aluno@example.test",
      role: "STUDENT",
      plan: "FREE",
    }),
    InvalidProgressError,
  );
});

test("password validation applies the same practical server requirements", () => {
  assert.equal(validatePassword("SenhaSegura123"), null);
  assert.match(validatePassword("curta1") ?? "", /10/);
  assert.match(validatePassword("apenasletras") ?? "", /número/i);
  assert.match(validatePassword("1234567890") ?? "", /letra/i);
});

test("the backend owns valid plan and price configuration", () => {
  assert.equal(getPlan("premium"), null);
  assert.equal(getPlan("premium-monthly")?.priceInCents, 3_990);
  assert.equal(getPlan("free")?.priceInCents, 0);
});

test("Hotmart events map to internal subscription states", () => {
  assert.equal(mapHotmartEventStatus("PURCHASE_APPROVED"), "ACTIVE");
  assert.equal(mapHotmartEventStatus("PURCHASE_DELAYED"), "PAST_DUE");
  assert.equal(mapHotmartEventStatus("SUBSCRIPTION_CANCELLATION"), "CANCELED");
  assert.equal(mapHotmartEventStatus("PURCHASE_EXPIRED"), "EXPIRED");
  assert.equal(mapHotmartEventStatus("PURCHASE_REFUNDED"), "REFUNDED");
  assert.equal(mapHotmartEventStatus("PURCHASE_CHARGEBACK"), "REFUNDED");
  assert.equal(mapHotmartEventStatus("UNKNOWN_EVENT"), null);
});

test("Hotmart webhook authentication rejects missing and forged secrets", () => {
  withEnvironment({ HOTMART_WEBHOOK_SECRET: "real-hottok" }, () => {
    assert.equal(
      verifyHotmartWebhook(new Headers({ "x-hotmart-hottok": "real-hottok" })),
      true,
    );
    assert.equal(
      verifyHotmartWebhook(
        new Headers({ "x-hotmart-hottok": "forged-hottok" }),
      ),
      false,
    );
    assert.equal(verifyHotmartWebhook(new Headers()), false);
  });
  withEnvironment(
    { HOTMART_WEBHOOK_SECRET: undefined, BILLING_WEBHOOK_SECRET: undefined },
    () =>
      assert.throws(
        () => verifyHotmartWebhook(new Headers()),
        BillingNotConfiguredError,
      ),
  );
});

test("free plan cannot self-grant premium entitlements", () => {
  assert.equal(hasEntitlement("free", "projects"), false);
  assert.equal(hasEntitlement("free", "advanced_tutor"), false);
  assert.equal(hasEntitlement("free", "language:javascript"), true);
  assert.equal(hasEntitlement("pro", "projects"), true);
});
