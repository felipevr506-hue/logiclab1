import { verifyDevelopmentSignup, testUsername } from "./auth-helpers";
import { expect, test } from "@playwright/test";

const mutationHeaders = {
  "content-type": "application/json",
  "x-logiclab-request": "same-origin",
};

test("server isolates students and rejects forged role, plan and XP", async ({
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "Server-side isolation only needs one browser profile.");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emailA = `student-a-${suffix}@logiclab.dev`;
  const emailB = `student-b-${suffix}@logiclab.dev`;
  const password = "SenhaSegura123";
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    for (const [context, email] of [
      [contextA, emailA],
      [contextB, emailB],
    ] as const) {
      const signup = await context.request.post("/api/auth/signup", {
        headers: mutationHeaders,
        data: {
          name: "Aluno isolado",
          email,
          username: testUsername(email),
          password,
          passwordConfirmation: password,
          acceptedTerms: true,
        },
      });
      expect(signup.status()).toBe(201);
      await verifyDevelopmentSignup(context.request, await signup.json());
    }

    const forgedState = {
      hydrated: true,
      user: {
        name: "Forged administrator",
        email: emailA,
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
      userLanguages: [{ languageId: "cpp", unlockedBy: "plan" }],
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
    const saved = await contextA.request.put("/api/progress", {
      headers: mutationHeaders,
      data: { account: emailA, baseRevision: 0, state: forgedState },
    });
    expect(saved.ok()).toBeTruthy();
    const savedPayload = await saved.json();
    expect(savedPayload.snapshot.state.user.role).toBe("student");
    expect(savedPayload.snapshot.state.user.plan).toBe("free");
    expect(savedPayload.snapshot.state.xp).toBe(0);
    expect(savedPayload.snapshot.state.level).toBe(1);
    expect(savedPayload.snapshot.state.userLanguages).toHaveLength(1);

    const crossUser = await contextB.request.get(
      `/api/progress?account=${encodeURIComponent(emailA)}`,
    );
    expect(crossUser.status()).toBe(403);
    expect((await contextA.request.get("/api/admin/security")).status()).toBe(
      403,
    );
    const featureEscalation = await contextA.request.put("/api/features", {
      headers: mutationHeaders,
      data: { key: "PLAYGROUND", enabled: false },
    });
    expect(featureEscalation.status()).toBe(403);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
