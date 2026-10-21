import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { authHeaders, verifyDevelopmentSignup } from "./auth-helpers";
import { dailyWorkouts } from "../../lib/daily-workouts";
import { Client } from "pg";

const password = "ExerciseSecurePassword123";
const correct = 'const nome = "Ada"; console.log("Olá, " + nome + "!");';
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});
async function register(page: Page) {
  const suffix = randomBytes(6).toString("hex");
  const input = {
    name: "Aluno " + suffix,
    username: "exercise_" + suffix,
    email: suffix + "@example.test",
    password,
    passwordConfirmation: password,
    acceptedTerms: true,
  };
  const response = await page.request.post("/api/auth/signup", {
    headers: authHeaders,
    data: input,
  });
  expect(response.status()).toBe(201);
  const payload = await response.json();
  await verifyDevelopmentSignup(page.request, payload);
  expect(
    (
      await page.request.post("/api/profile/onboarding", {
        headers: authHeaders,
        data: {
          experience: "Nunca",
          goal: "Aprender programação",
          dailyMinutes: 20,
          locale: "pt-BR",
          initialLanguage: "javascript",
        },
      })
    ).status(),
  ).toBe(200);
  return { ...input, id: payload.account.id as string };
}
async function open(page: Page) {
  await page.goto("/treino/primeiros-passos");
  await expect(page.locator(".monaco-editor")).toBeVisible();
}
async function edit(page: Page, code: string) {
  await page.locator(".monaco-editor").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(code);
}
async function submit(page: Page) {
  const receipt = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/attempts") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Enviar resposta", exact: true })
    .click();
  const response = await receipt;
  expect(response.status()).toBe(200);
  return response.json();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(2);
}

test("desktop opens directly with large editor, optional Tutor, focus and no answer controls", async ({
  page,
}) => {
  await register(page);
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".tutor-panel")).toHaveCount(0);
  expect(
    (await page.locator(".monaco-wrap").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(390);
  await noOverflow(page);
  await page.screenshot({
    path: ".tmp/phase6-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Abrir Tutor", exact: true }).click();
  await expect(page.locator(".tutor-panel")).toBeVisible();
  await page
    .getByRole("button", { name: "Me dê uma dica", exact: true })
    .click();
  await expect(
    page.locator(".tutor-message.tutor:not(.tutor-thinking)"),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "A resposta do Tutor ajudou", exact: true })
    .click();
  await page
    .locator(".tutor-panel")
    .getByRole("button", { name: "Fechar Tutor" })
    .click();
  await expect(page.locator(".tutor-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir Tutor", exact: true }).click();
  await expect(
    page.locator(".tutor-message.tutor:not(.tutor-thinking)"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", {
      name: "A resposta do Tutor ajudou",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    await page
      .locator(".tutor-conversation")
      .evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(2);
  await expect(
    page.getByRole("button", {
      name: /solução completa|liberar a solução|Mostrar solução|Ver uma possível solução/i,
    }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".tmp/phase6-tutor-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".tutor-panel")
    .getByRole("button", { name: "Fechar Tutor" })
    .click();
  await page
    .getByRole("button", { name: "Expandir editor", exact: true })
    .click();
  await expect(page.locator(".code-panel")).toHaveClass(/editor-expanded/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".code-panel")).not.toHaveClass(/editor-expanded/);
});

test("preview errors, official failure, pending, success and repeat remain distinct", async ({
  page,
}) => {
  await register(page);
  await open(page);
  await edit(page, 'throw new Error("falha local de teste")');
  await page.getByRole("button", { name: "Executar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Erro de execução ou envio" }),
  ).toBeVisible();
  await edit(page, 'const nome = "Bob"; console.log("Olá, Bob!");');
  const failed = await submit(page);
  expect(failed.attempt.passed).toBe(false);
  await expect(page.getByRole("heading", { name: /Falhou/ })).toBeVisible();
  await edit(
    page,
    correct + '\nfunction alternativa() { return "outro caminho"; }',
  );
  const pending = await submit(page);
  expect(pending.evaluationStatus).toBe("pending");
  await expect(
    page.getByRole("heading", { name: "Validação pendente no servidor" }),
  ).toBeVisible();
  await edit(page, correct);
  const first = await submit(page);
  expect(first.firstCompletion).toBe(true);
  expect(first.xpAwarded).toBe(90);
  await expect(
    page.getByRole("heading", { name: "Passou · resposta aprovada" }),
  ).toBeVisible();
  const repeat = await submit(page);
  expect(repeat.firstCompletion).toBe(false);
  expect(repeat.xpAwarded).toBe(0);
  await page
    .locator("summary")
    .filter({ hasText: "Dicas progressivas" })
    .click();
  for (let hint = 1; hint <= 3; hint++) {
    await page
      .getByRole("button", { name: `Ver dica ${hint}`, exact: true })
      .click();
    await expect(
      page.locator("summary").filter({ hasText: "Dicas progressivas" }),
    ).toContainText(`${hint}/3`);
  }
  await page.getByRole("button", { name: "Abrir Tutor", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /solução completa|liberar a solução|Mostrar solução|Ver uma possível solução/i,
    }),
  ).toHaveCount(0);
  await expect(
    page.locator(".solution-code, .reference-solution, .request-solution"),
  ).toHaveCount(0);
  await page.reload();
  const official = await (await page.request.get("/api/attempts")).json();
  expect(official.official.progress.xp).toBe(90);
});

test("mobile uses Problem Code Tutor tabs, keeps results accessible and fits screen", async ({
  page,
}) => {
  await register(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/treino/primeiros-passos");
  await expect(
    page.getByRole("tab", { name: "Problema", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".monaco-editor")).toBeHidden();
  await page.screenshot({
    path: ".tmp/phase6-mobile-problem.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: "Código", exact: true }).click();
  await edit(page, correct);
  await submit(page);
  await expect(
    page.getByRole("heading", { name: "Passou · resposta aprovada" }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: ".tmp/phase6-mobile-code.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: "Tutor", exact: true }).click();
  await expect(page.locator(".tutor-panel")).toBeVisible();
  await expect(page.locator(".monaco-editor")).toBeHidden();
  await noOverflow(page);
  await page.screenshot({
    path: ".tmp/phase6-mobile-tutor.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".tutor-panel")
    .getByRole("button", { name: "Fechar Tutor" })
    .click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
});

test("drafts and Tutor history remain owned across logout, account switch and return", async ({
  page,
}) => {
  const a = await register(page);
  await open(page);
  await edit(page, "// rascunho exclusivo conta A\n" + correct);
  const keyA = `logiclab-state-v2:${a.id}`;
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) ?? "{}").drafts?.[
            "primeiros-passos"
          ],
        keyA,
      ),
    )
    .toContain("exclusivo conta A");
  await page.getByRole("button", { name: "Abrir Tutor", exact: true }).click();
  await page
    .getByLabel("Pergunta para o tutor")
    .fill("Pergunta exclusiva conta A");
  await page.getByRole("button", { name: "Enviar pergunta ao tutor" }).click();
  await expect(
    page.locator(".tutor-message.tutor:not(.tutor-thinking)"),
  ).toHaveCount(2);
  const storedQuestion = () =>
    page.evaluate(
      (key) =>
        (
          JSON.parse(localStorage.getItem(key) ?? "{}").tutorMessages?.[
            "primeiros-passos"
          ] ?? []
        ).some(
          (message: { content: string }) =>
            message.content === "Pergunta exclusiva conta A",
        ),
      keyA,
    );
  await expect
    .poll(storedQuestion, { message: "A history is persisted before logout" })
    .toBe(true);
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page).toHaveURL("http://127.0.0.1:3208/");
  expect(await storedQuestion(), "A history is retained on logout").toBe(true);
  const b = await register(page);
  await open(page);
  await expect(page.locator(".monaco-editor")).not.toContainText(
    "exclusivo conta A",
  );
  await page.getByRole("button", { name: "Abrir Tutor", exact: true }).click();
  await expect(
    page.locator(".tutor-message.tutor:not(.tutor-thinking)"),
  ).toHaveCount(1);
  expect(await storedQuestion(), "B does not overwrite A history").toBe(true);
  const officialB = await (await page.request.get("/api/attempts")).json();
  expect(officialB.official.progress.xp).toBe(0);
  await edit(page, "// rascunho conta B");
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) ?? "{}").drafts?.[
            "primeiros-passos"
          ],
        `logiclab-state-v2:${b.id}`,
      ),
    )
    .toContain("conta B");
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page).toHaveURL("http://127.0.0.1:3208/");
  expect(await storedQuestion(), "B logout does not overwrite A history").toBe(
    true,
  );
  expect(
    (
      await page.request.post("/api/auth/login", {
        headers: authHeaders,
        data: { email: a.email, password },
      })
    ).status(),
  ).toBe(200);
  await open(page);
  await expect(page.locator(".monaco-editor")).toContainText(
    "exclusivo conta A",
  );
  await expect(page.locator(".monaco-editor")).not.toContainText(
    "rascunho conta B",
  );
  await page.getByRole("button", { name: "Abrir Tutor", exact: true }).click();
  await expect(
    page.getByText("Pergunta exclusiva conta A", { exact: true }),
  ).toBeVisible();
});

test("historical complete answers are hidden while the original stored record remains intact", async ({
  page,
}) => {
  const a = await register(page);
  await open(page);
  const key = `logiclab-state-v2:${a.id}`;
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
    .not.toBeNull();
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.tutorMessages["primeiros-passos"] = [
      {
        id: "legacy-answer",
        exerciseId: "primeiros-passos",
        role: "tutor",
        content: "REFERENCE_ANSWER_NOT_FOR_DISPLAY",
        helpLevel: 5,
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem(key, JSON.stringify(state));
  }, key);
  await page.reload();
  await page.getByRole("button", { name: "Abrir Tutor", exact: true }).click();
  await expect(
    page.getByText(/Resposta completa antiga ocultada/),
  ).toBeVisible();
  await expect(
    page.getByText("REFERENCE_ANSWER_NOT_FOR_DISPLAY", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Salvar explicação", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)!).tutorMessages[
          "primeiros-passos"
        ][0].content,
      key,
    ),
  ).toBe("REFERENCE_ANSWER_NOT_FOR_DISPLAY");
});

test("existing exercise routes retain their own problem and usable editor", async ({
  page,
}) => {
  const account = await register(page);
  const url = process.env.PHASE2_DATABASE_URL;
  if (
    !url ||
    !/^\/logiclab_phase2_test_[a-f0-9]{12}$/.test(new URL(url).pathname)
  )
    throw new Error("Refusing a non-test database.");
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query(
      'UPDATE "User" SET "createdAt"=now()-interval \'60 days\' WHERE id=$1',
      [account.id],
    );
    await db.query(
      "UPDATE \"Subscription\" SET plan='PRO', status='ACTIVE', \"currentPeriodEnd\"=now()+interval '30 days' WHERE \"userId\"=$1",
      [account.id],
    );
  } finally {
    await db.end();
  }
  for (const workout of dailyWorkouts) {
    await page.goto(`/treino/${workout.exerciseId}?etapa=pratica`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".monaco-editor")).toBeVisible();
    await expect(
      page.locator(".solution-code, .reference-solution, .request-solution"),
    ).toHaveCount(0);
  }
});
