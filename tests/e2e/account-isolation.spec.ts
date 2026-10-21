import { finishDevelopmentVerification, testUsername } from "./auth-helpers";
import { expect, test, type Page } from "@playwright/test";
import type { AppState } from "../../lib/types";

const password = "IsolationPassword123";
const headers = { "x-logiclab-request": "same-origin" };

test("explicit demo configuration enables only the separate demo identity", async ({
  page,
}) => {
  test.skip(
    process.env.PHASE1_AUTH_MODE !== "demo",
    "Runs against the explicitly enabled demo server.",
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  const response = await page.request.get("/api/auth/me");
  expect(await response.json()).toMatchObject({
    demo: true,
    account: { id: "local-demo", email: "aluno@demo.dev" },
  });
  const state = await readState(page, "local-demo");
  expect(state.user.accountId).toBe("local-demo");
  expect(state.xp).toBe(0);
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Reiniciar dados" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page).toHaveURL(/\/perfil$/);
  expect(await (await page.request.get("/api/auth/me")).json()).toMatchObject({
    demo: true,
    account: { id: "local-demo" },
  });
});

async function currentAccount(page: Page) {
  const response = await page.request.get("/api/auth/me");
  return (await response.json()).account as { id: string; email: string };
}

async function readState(page: Page, id: string): Promise<AppState> {
  const key = `logiclab-state-v2:${encodeURIComponent(id)}`;
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
    .not.toBeNull();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}

async function signup(page: Page, name: string, email: string) {
  await page.goto("/cadastro");
  await page.getByPlaceholder("Como podemos chamar você?").fill(name);
  await page.getByLabel("E-mail").fill(email);
  if (await page.getByLabel("Username", { exact: true }).count())
    await page
      .getByLabel("Username", { exact: true })
      .fill(testUsername(email));
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /criar conta/i }).click();
  await finishDevelopmentVerification(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  const account = await currentAccount(page);
  await readState(page, account.id);
  return account;
}

async function login(page: Page, email: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  if (await page.getByLabel("Username", { exact: true }).count())
    await page
      .getByLabel("Username", { exact: true })
      .fill(testUsername(email));
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)$/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(async () => (await page.request.get("/api/auth/me")).json())
    .toMatchObject({ account: null, demo: false });
}

async function indexedAttempts(page: Page, id: string) {
  const name = `logiclab-training-v2:${encodeURIComponent(id)}`;
  await expect
    .poll(() =>
      page.evaluate(
        async (name) =>
          (await indexedDB.databases()).some((db) => db.name === name),
        name,
      ),
    )
    .toBe(true);
  return page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const result = database
            .transaction("attempts")
            .objectStore("attempts")
            .getAll();
          result.onsuccess = () => {
            database.close();
            resolve(result.result);
          };
          result.onerror = () => {
            database.close();
            reject(result.error);
          };
        };
      }),
    name,
  );
}

test("visitor stays anonymous and learning requires authentication by default", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await (await page.request.get("/api/auth/me")).json()).toMatchObject({
    account: null,
    demo: false,
  });
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("logiclab-state"),
      ),
    ),
  ).toEqual([]);
  await page
    .getByRole("link", { name: "Começar grátis", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/entrar\?next=/);
});

test("A progress survives logout while B and a new account start isolated in the same browser", async ({
  page,
}) => {
  const suffix = `${Date.now()}`;
  const accountA = await signup(
    page,
    "Conta Alfa",
    `alfa-${suffix}@example.test`,
  );
  await page.getByRole("button", { name: "Pular por agora" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.goto("/perfil");
  await expect(
    page.getByRole("button", { name: "Reiniciar dados" }),
  ).toHaveCount(0);
  // Exercise the real editor, test runner and progress actions rather than just seeding storage.
  await page.goto("/treino/primeiros-passos?etapa=pratica");
  const editor = page.locator(".monaco-editor");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(
    'const nome = "Ada";\nconsole.log("Olá, " + nome + "!");',
  );
  await page
    .getByRole("button", { name: "Enviar resposta", exact: true })
    .click();
  await expect
    .poll(
      async () => (await readState(page, accountA.id)).attemptHistory.length,
    )
    .toBeGreaterThan(0);
  const stateA = await readState(page, accountA.id);
  expect(stateA.drafts["primeiros-passos"]).toContain("Ada");
  expect(stateA.xp).toBeGreaterThan(0);
  expect(stateA.completedExercises).toContain("primeiros-passos");
  await expect
    .poll(async () => (await indexedAttempts(page, accountA.id)).length)
    .toBeGreaterThan(0);
  const dbNameA = `logiclab-training-v2:${accountA.id}`;
  await expect
    .poll(() =>
      page.evaluate(
        async (name) =>
          (await indexedDB.databases()).some((db) => db.name === name),
        dbNameA,
      ),
    )
    .toBe(true);

  await page.goto("/dashboard");
  await logout(page);
  const accountB = await signup(
    page,
    "Conta Beta",
    `beta-${suffix}@example.test`,
  );
  const clean = await readState(page, accountB.id);
  expect(clean.user.name).toBe("Conta Beta");
  expect(clean.user.accountId).toBe(accountB.id);
  expect(clean.xp).toBe(0);
  expect(clean.level).toBe(1);
  expect(clean.theme).toBe("dark");
  expect(await indexedAttempts(page, accountB.id)).toEqual([]);
  for (const field of [
    "completedExercises",
    "attemptHistory",
    "favorites",
    "xpTransactions",
    "codeVersions",
    "activeDays",
    "savedTutorExplanations",
    "savedCodeSnippets",
  ] as const)
    expect(clean[field]).toEqual([]);
  for (const field of [
    "drafts",
    "tutorMessages",
    "notes",
    "attempts",
    "hintsUsed",
    "userSkills",
  ] as const)
    expect(clean[field]).toEqual({});
  await page.getByRole("button", { name: "Pular por agora" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/treino/primeiros-passos?etapa=pratica");
  await expect(editor).toBeVisible();
  expect(
    (await readState(page, accountB.id)).drafts["primeiros-passos"] ?? "",
  ).not.toContain("Ada");
  // Backups are authorized by the session, never by an arbitrary owner ID.
  expect(
    (
      await page.request.get(
        `/api/progress?account=${encodeURIComponent(accountA.email)}&ownerId=${accountA.id}`,
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.put("/api/progress", {
        headers,
        data: {
          account: accountB.email,
          ownerId: accountA.id,
          baseRevision: 0,
          state: clean,
        },
      })
    ).status(),
  ).toBe(403);

  await page.goto("/dashboard");
  await logout(page);
  await login(page, accountA.email);
  const restored = await readState(page, accountA.id);
  expect(restored.user.name).toBe("Conta Alfa");
  expect(restored.drafts).toEqual(stateA.drafts);
  expect(restored.attemptHistory).toEqual(stateA.attemptHistory);
  expect(restored.completedExercises).toEqual(stateA.completedExercises);
  expect(restored.xp).toBe(stateA.xp);
  expect(restored.theme).toBe("light");
  expect(await indexedAttempts(page, accountA.id)).toEqual(
    stateA.attemptHistory,
  );
  await page.goto("/treino/primeiros-passos?etapa=pratica");
  await expect(page.locator(".view-lines")).toContainText("Ada");
});

test("logout invalidates another open tab without exposing the old account", async ({
  page,
  context,
}) => {
  await signup(page, "Conta em Abas", `tabs-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "Pular por agora" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const other = await context.newPage();
  await other.goto("/dashboard");
  await expect(other.getByRole("heading", { name: /Conta/ })).toBeVisible();
  await logout(page);
  await expect(other).toHaveURL(/\/entrar\?next=/);
  await expect(
    other.getByRole("heading", { name: /Bem-vindo|Acesse|Entre/i }).first(),
  ).toBeVisible();
  await other.close();
});

test("legacy shared data is preserved but never attributed to a new account", async ({
  page,
}) => {
  await page.goto("/");
  const legacy = JSON.stringify({
    user: { name: "Alex", email: "old@example.test" },
    xp: 9999,
    drafts: { variaveis: "PRIVATE OLD CODE" },
    favorites: ["condicoes"],
  });
  await page.evaluate(
    (value) => localStorage.setItem("logiclab-state-v1", value),
    legacy,
  );
  const account = await signup(
    page,
    "Conta Limpa",
    `clean-${Date.now()}@example.test`,
  );
  const state = await readState(page, account.id);
  expect(state.user.name).toBe("Conta Limpa");
  expect(state.xp).toBe(0);
  expect(state.drafts).toEqual({});
  expect(state.favorites).toEqual([]);
  expect(
    await page.evaluate(() => localStorage.getItem("logiclab-state-v1")),
  ).toBe(legacy);
});
