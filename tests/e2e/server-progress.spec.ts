import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { authHeaders, verifyDevelopmentSignup } from "./auth-helpers";

const password = "Phase3SecurePassword123";
const code = 'const nome = "Ada"; console.log("Olá, " + nome + "!");';
async function register(request: APIRequestContext, verified = true) {
  const id = randomBytes(6).toString("hex");
  const input = {
    name: "Conta " + id,
    username: "phase3_" + id,
    email: `${id}@example.test`,
    password,
    passwordConfirmation: password,
    acceptedTerms: true,
  };
  const response = await request.post("/api/auth/signup", {
    headers: authHeaders,
    data: input,
  });
  expect(response.status()).toBe(201);
  const payload = await response.json();
  if (verified) await verifyDevelopmentSignup(request, payload);
  return { input, account: payload.account, payload };
}
const submission = (key = randomUUID()) => ({
  exerciseId: "primeiros-passos",
  code,
  activityMode: "path",
  idempotencyKey: key,
});
async function submit(request: APIRequestContext, data = submission()) {
  return request.post("/api/attempts", { headers: authHeaders, data });
}
async function official(request: APIRequestContext) {
  const response = await request.get("/api/attempts");
  expect(response.status()).toBe(200);
  return (await response.json()).official;
}
async function sql(query: string, values: unknown[] = []) {
  const url = process.env.PHASE2_DATABASE_URL;
  if (
    !url ||
    !/^\/logiclab_phase2_test_[a-f0-9]{12}$/.test(new URL(url).pathname)
  )
    throw new Error("Refusing a non-test database.");
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query("SET TIME ZONE 'UTC'");
    return await db.query(query, values);
  } finally {
    await db.end();
  }
}

test("official attempts require verified sessions and reject client XP, results and another user's ID", async ({
  request,
  browser,
}) => {
  expect((await submit(request)).status()).toBe(401);
  const a = await register(request, false);
  expect((await submit(request)).status()).toBe(401);
  await verifyDevelopmentSignup(request, a.payload);
  expect((await official(request)).progress.xp).toBe(0);
  for (const claim of [{}, { projectId: "calculadora" }]) {
    const response = await request.post("/api/attempts/claim", {
      headers: authHeaders,
      data: claim,
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).official.progress.xp).toBe(0);
  }
  expect(
    (
      await request.post("/api/attempts/claim", {
        headers: authHeaders,
        data: { xp: 99999 },
      })
    ).status(),
  ).toBe(400);
  const other = await browser.newContext();
  try {
    const b = await register(other.request);
    for (const extra of [
      { xp: 99999 },
      { passed: true },
      { userId: b.account.id },
      { ownerId: b.account.id },
      { tests: [{ passed: true }] },
      { level: 99 },
      { hintsUsed: 0 },
      { createdAt: "2000-01-01" },
      { masteryScore: 100 },
    ]) {
      expect(
        (
          await request.post("/api/attempts", {
            headers: authHeaders,
            data: { ...submission(), ...extra },
          })
        ).status(),
      ).toBe(400);
    }
    expect(
      (await request.get(`/api/attempts?ownerId=${b.account.id}`)).status(),
    ).toBe(400);
    const result = await submit(request);
    expect(result.status()).toBe(200);
    expect((await result.json()).official.ownerId).toBe(a.account.id);
    expect((await official(other.request)).progress.xp).toBe(0);
    expect((await official(other.request)).progress.completedExercises).toEqual(
      [],
    );
  } finally {
    await other.close();
  }
});

test("first completion awards correct XP, identical retries replay and new attempts cannot re-award it", async ({
  request,
}) => {
  const { account } = await register(request);
  const input = submission();
  const firstResponse = await submit(request, input);
  expect(firstResponse.status()).toBe(200);
  const first = await firstResponse.json();
  expect(first).toMatchObject({
    evaluationStatus: "verified",
    firstCompletion: true,
    xpAwarded: 90,
    replayed: false,
  });
  expect(first.official.progress).toMatchObject({
    xp: 90,
    level: 1,
    streak: 1,
    completedExercises: [input.exerciseId],
  });
  const replay = await (await submit(request, input)).json();
  expect(replay.replayed).toBe(true);
  expect(replay.attempt.id).toBe(first.attempt.id);
  expect(replay.official.progress.xp).toBe(90);
  expect(
    (
      await submit(request, { ...input, code: "const nome = 'wrong';" })
    ).status(),
  ).toBe(409);
  const repeated = await (await submit(request)).json();
  expect(repeated).toMatchObject({ firstCompletion: false, xpAwarded: 0 });
  expect(repeated.official.progress.xp).toBe(90);
  expect(repeated.official.progress.userSkills).toEqual(
    first.official.progress.userSkills,
  );
  const rows = await sql(
    'SELECT (SELECT count(*)::int FROM "Attempt" WHERE "userId"=$1) AS attempts, (SELECT count(*)::int FROM "XPTransaction" WHERE "userId"=$1 AND reason=\'exercise_completion\') AS completions, (SELECT sum(amount)::int FROM "XPTransaction" WHERE "userId"=$1) AS xp',
    [account.id],
  );
  expect(rows.rows[0]).toEqual({ attempts: 2, completions: 1, xp: 90 });
});

test("two actual tabs completing simultaneously serialize rewards; a shared key also creates only one attempt", async ({
  page,
  context,
}) => {
  const { account } = await register(page.request);
  const second = await context.newPage();
  await page.goto("/verificar-email");
  await second.goto("/verificar-email");
  const post = (target: typeof page, input: ReturnType<typeof submission>) =>
    target.evaluate(
      async ({ input, headers }) => {
        const response = await fetch("/api/attempts", {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        });
        return { status: response.status, data: await response.json() };
      },
      { input, headers: authHeaders },
    );
  const results = await Promise.all([
    post(page, submission()),
    post(second, submission()),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results.filter((r) => r.data.firstCompletion)).toHaveLength(1);
  expect((await official(page.request)).progress.xp).toBe(90);
  const key = submission();
  const duplicates = await Promise.all([post(page, key), post(second, key)]);
  expect(duplicates[0].data.attempt.id).toBe(duplicates[1].data.attempt.id);
  expect(duplicates.filter((r) => r.data.replayed)).toHaveLength(1);
  expect(
    (
      await sql(
        'SELECT count(*)::int AS count FROM "Attempt" WHERE "userId"=$1',
        [account.id],
      )
    ).rows[0].count,
  ).toBe(3);
  expect((await official(page.request)).progress.xp).toBe(90);
  await second.close();
});

test("official hint history controls the no-hint bonus and weekly practice rewards are unique", async ({
  request,
}) => {
  await register(request);
  const hint = await request.post("/api/attempts/hint", {
    headers: authHeaders,
    data: { exerciseId: "primeiros-passos" },
  });
  expect(hint.status()).toBe(200);
  expect((await hint.json()).hintCount).toBe(1);
  const result = await (await submit(request)).json();
  expect(result.attempt.hintsUsed).toBe(1);
  expect(result.xpAwarded).toBe(80);
  expect(
    result.official.progress.xpTransactions.some(
      (t: { reason: string }) => t.reason === "no_hint",
    ),
  ).toBe(false);
  const practice = await request.post("/api/attempts", {
    headers: authHeaders,
    data: { ...submission(), activityMode: "practice" },
  });
  expect((await practice.json()).xpAwarded).toBe(15);
  const repeated = await request.post("/api/attempts", {
    headers: authHeaders,
    data: { ...submission(), activityMode: "practice" },
  });
  expect((await repeated.json()).xpAwarded).toBe(0);
  expect((await official(request)).progress.xp).toBe(95);
});

test("official level, skill, streak and level rewards agree with normalized PostgreSQL records", async ({
  request,
}) => {
  const { account } = await register(request);
  expect((await submit(request)).status()).toBe(200);
  const practice = await request.post("/api/attempts", {
    headers: authHeaders,
    data: { ...submission(), activityMode: "practice" },
  });
  expect(practice.status()).toBe(200);
  const data = await practice.json();
  expect(data.official.progress).toMatchObject({
    xp: 105,
    level: 2,
    streak: 1,
    longestStreak: 1,
  });
  expect(data.official.progress.userSkills.algoritmos.masteryScore).toBe(30);
  expect(
    data.official.progress.rewardGrants.filter(
      (g: { rewardId: string }) => g.rewardId === "badge-primeiros-passos",
    ),
  ).toHaveLength(1);
  const rows = await sql(
    'SELECT p."totalXp",p."currentLevel",p."masteryScore",s.current,s.longest,(SELECT sum(amount)::int FROM "XPTransaction" WHERE "userId"=$1) AS ledger FROM "UserProgress" p JOIN "Streak" s ON s."userId"=p."userId" WHERE p."userId"=$1',
    [account.id],
  );
  expect(rows.rows[0]).toMatchObject({
    totalXp: 105,
    currentLevel: 2,
    masteryScore: 30,
    current: 1,
    longest: 1,
    ledger: 105,
  });
  expect(
    (
      await sql(
        'SELECT count(*)::int AS count FROM "UserReward" u JOIN "Reward" r ON r.id=u."rewardId" WHERE u."userId"=$1 AND r.slug=\'badge-primeiros-passos\'',
        [account.id],
      )
    ).rows[0].count,
  ).toBe(1);
  const pending = await request.post("/api/attempts", {
    headers: authHeaders,
    data: {
      ...submission(),
      exerciseId: "funcoes",
      code: "function calcularDobro(n) { return n+n; }",
      activityMode: "practice",
    },
  });
  expect(pending.status()).toBe(200);
  expect((await pending.json()).evaluationStatus).toBe("pending");
  expect((await official(request)).progress.xp).toBe(105);
});

test("a PostgreSQL reward failure rolls back attempts, XP, completion and mastery atomically", async ({
  request,
}) => {
  const { account } = await register(request);
  const input = submission();
  await sql(
    `CREATE FUNCTION phase3_fail_reward() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Phase 3 intentional rollback'; END $$`,
  );
  await sql(
    'CREATE TRIGGER phase3_fail_reward BEFORE INSERT ON "XPTransaction" FOR EACH ROW EXECUTE FUNCTION phase3_fail_reward()',
  );
  try {
    expect((await submit(request, input)).status()).toBe(503);
    const rows = await sql(
      'SELECT (SELECT count(*)::int FROM "Attempt" WHERE "userId"=$1) AS attempts,(SELECT count(*)::int FROM "XPTransaction" WHERE "userId"=$1) AS xp,(SELECT count(*)::int FROM "ExerciseProgress" WHERE "userId"=$1) AS progress,(SELECT count(*)::int FROM "UserSkill" WHERE "userId"=$1) AS skills',
      [account.id],
    );
    expect(rows.rows[0]).toEqual({
      attempts: 0,
      xp: 0,
      progress: 0,
      skills: 0,
    });
    expect((await official(request)).progress).toMatchObject({
      xp: 0,
      completedExercises: [],
      userSkills: {},
    });
  } finally {
    await sql('DROP TRIGGER phase3_fail_reward ON "XPTransaction"');
    await sql("DROP FUNCTION phase3_fail_reward()");
  }
  expect((await submit(request, input)).status()).toBe(200);
  expect((await official(request)).progress.xp).toBe(90);
});

test("logout/login and account switches retain official progress while localStorage and backup forgeries cannot override it", async ({
  page,
}) => {
  const a = await register(page.request);
  expect((await submit(page.request)).status()).toBe(200);
  await page.goto("/onboarding");
  const key = `logiclab-state-v2:${a.account.id}`;
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.xp,
        key,
      ),
    )
    .toBe(90);
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.xp = 999999;
    state.level = 99;
    state.completedExercises = ["calculadora"];
    state.attempts = { calculadora: 999 };
    state.drafts.private = "A_PRIVATE_CODE";
    localStorage.setItem(key, JSON.stringify(state));
  }, key);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.xp,
        key,
      ),
    )
    .toBe(90);
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  );
  expect(state.completedExercises).toEqual(["primeiros-passos"]);
  expect(state.drafts.private).toBe("A_PRIVATE_CODE");
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(
              `/api/progress?account=${a.input.email}&ownerId=${a.account.id}`,
            )
          ).json()
        ).snapshot !== null,
    )
    .toBe(true);
  const current = await (
    await page.request.get(
      `/api/progress?account=${a.input.email}&ownerId=${a.account.id}`,
    )
  ).json();
  const backup = await page.request.put("/api/progress", {
    headers: authHeaders,
    data: {
      account: a.input.email,
      ownerId: a.account.id,
      baseRevision: current.snapshot.revision,
      state: {
        ...state,
        xp: 99999,
        level: 99,
        completedExercises: ["calculadora"],
        xpTransactions: [
          {
            id: "fake",
            uniqueKey: "fake",
            amount: 99999,
            reason: "exercise_completion",
          },
        ],
      },
    },
  });
  expect([200, 409]).toContain(backup.status());
  expect((await backup.json()).snapshot.state.xp).toBe(90);
  expect((await official(page.request)).progress.completedExercises).toEqual([
    "primeiros-passos",
  ]);
  await page.request.post("/api/auth/logout", { headers: authHeaders });
  await page.goto("/entrar");
  expect(
    (await (await page.request.get("/api/auth/me")).json()).account,
  ).toBeNull();
  const b = await register(page.request);
  await page.goto("/onboarding");
  const keyB = `logiclab-state-v2:${b.account.id}`;
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.xp,
        keyB,
      ),
    )
    .toBe(0);
  expect((await official(page.request)).progress.completedExercises).toEqual(
    [],
  );
  const clean = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    keyB,
  );
  expect(clean.drafts.private).toBeUndefined();
  await page.request.post("/api/auth/logout", { headers: authHeaders });
  const login = await page.request.post("/api/auth/login", {
    headers: authHeaders,
    data: { email: a.input.email, password },
  });
  expect(login.status()).toBe(200);
  await page.goto("/onboarding");
  expect((await official(page.request)).progress.xp).toBe(90);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.xp,
        key,
      ),
    )
    .toBe(90);
});

test("browser confirmations release retry keys, repeated submissions and reload never duplicate completion XP", async ({
  page,
}) => {
  const { account } = await register(page.request);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Pular por agora" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/treino/primeiros-passos?etapa=pratica");
  const editor = page.locator(".monaco-editor");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(code);
  const stateKey = `logiclab-state-v2:${account.id}`;
  const retryKey = `logiclab-attempt-pending:${account.id}:primeiros-passos`;
  for (let number = 1; number <= 2; number++) {
    const resultPromise = page
      .waitForResponse(
        (response) =>
          response.url().endsWith("/api/attempts") &&
          response.request().method() === "POST",
      )
      .then((response) => response.json());
    await page
      .getByRole("button", { name: "Enviar resposta", exact: true })
      .click();
    const result = await resultPromise;
    expect(result.replayed).toBe(false);
    expect(result.attempt.attemptNumber).toBe(number);
    expect(result.xpAwarded).toBe(number === 1 ? 90 : 0);
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), retryKey))
      .toBeNull();
  }
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.xp,
        stateKey,
      ),
    )
    .toBe(90);
  expect(
    (
      await sql(
        'SELECT count(*)::int AS count FROM "Attempt" WHERE "userId"=$1',
        [account.id],
      )
    ).rows[0].count,
  ).toBe(2);
});
