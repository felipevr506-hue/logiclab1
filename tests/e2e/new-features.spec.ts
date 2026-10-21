import { verifyDevelopmentSignup, testUsername } from "./auth-helpers";
import { expect, test } from "@playwright/test";
import { getDailyWorkout } from "@/lib/daily-workouts";

const mutationHeaders = { "x-logiclab-request": "same-origin" };

test.describe("novas funções integradas", () => {
  test("homepage apresenta uma única prévia sem animações decorativas", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".matrix-rain")).toHaveCount(0);
    await expect(page.locator("main figure")).toHaveCount(1);
    await expect(
      page.getByText("Prévia ilustrativa · JavaScript"),
    ).toBeVisible();
  });

  test("marca da área do aluno retorna à homepage e usa a paleta verde global", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--violet-bright")
            .trim(),
        ),
      )
      .toBe("#4df59b");
    const openMenu = page.getByRole("button", { name: "Abrir menu" });
    if (await openMenu.isVisible()) await openMenu.click();
    await page.getByRole("link", { name: "LogicLab — início" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /Aprenda programação/ }),
    ).toBeVisible();
  });

  test("Laboratório executa exemplos reais sem conceder XP", async ({
    page,
  }) => {
    await page.goto("/laboratorio");
    const readXp = () =>
      page.evaluate(() => {
        const saved = window.localStorage.getItem(
          "logiclab-state-v2:e2e-admin",
        );
        return saved ? ((JSON.parse(saved) as { xp?: number }).xp ?? 0) : 0;
      });
    const xpBefore = await readXp();
    await page.getByRole("button", { name: /Executar alteração/ }).click();
    const completedOutput = page
      .locator(".laboratory-terminal pre")
      .filter({ hasText: "Antes: 10" });
    await expect(completedOutput).toContainText("Depois: 15");
    await expect.poll(readXp).toBe(xpBefore);
  });

  test("Evolução e Portfólio mostram estados vazios baseados em dados reais", async ({
    page,
  }) => {
    await page.goto("/evolucao");
    await expect(
      page.getByRole("heading", {
        name: "Sua evolução começará na primeira tentativa",
      }),
    ).toBeVisible();
    await page.goto("/portfolio");
    await expect(
      page.getByRole("heading", {
        name: "Seu primeiro projeto aparecerá aqui",
      }),
    ).toBeVisible();
  });

  test("API de backup usa revisão otimista e detecta conflito", async ({
    request,
  }) => {
    const account = `e2e-${Date.now()}-${Math.random()}@logiclab.dev`;
    const password = "SenhaSegura123";
    const signup = await request.post("/api/auth/signup", {
      headers: mutationHeaders,
      data: {
        name: "Backup E2E",
        email: account,
        username: testUsername(account),
        password,
        passwordConfirmation: password,
        acceptedTerms: true,
      },
    });
    expect(signup.status()).toBe(201);
    await verifyDevelopmentSignup(request, await signup.json());
    const state = {
      user: { email: account },
      drafts: { conflict: "primeiro" },
      codeVersions: [],
      savedCodeSnippets: [],
      savedTutorExplanations: [],
      notificationPreferences: {},
    };
    const first = await request.put("/api/progress", {
      headers: mutationHeaders,
      data: { account, baseRevision: 0, state },
    });
    expect(first.ok()).toBeTruthy();
    expect((await first.json()).snapshot.revision).toBe(1);

    const stale = await request.put("/api/progress", {
      headers: mutationHeaders,
      data: {
        account,
        baseRevision: 0,
        state: {
          ...state,
          drafts: { conflict: "desatualizado" },
        },
      },
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).conflict).toBeTruthy();

    const loaded = await request.get(
      `/api/progress?account=${encodeURIComponent(account)}`,
    );
    expect((await loaded.json()).snapshot.state.drafts.conflict).toBe(
      "primeiro",
    );
  });

  test("Playground executa JavaScript sem conceder XP", async ({ page }) => {
    await page.goto("/playground");
    const readXp = () =>
      page.evaluate(() => {
        const saved = window.localStorage.getItem(
          "logiclab-state-v2:e2e-admin",
        );
        return saved ? ((JSON.parse(saved) as { xp?: number }).xp ?? 0) : 0;
      });
    const xpBefore = await readXp();
    await page.getByRole("button", { name: "Executar", exact: true }).click();
    await expect(page.getByText("Olá, Ada!", { exact: true })).toBeVisible();
    await expect.poll(readXp).toBe(xpBefore);
  });

  test("editor cria versão manual e permite abrir o histórico", async ({
    page,
  }) => {
    const workout = getDailyWorkout();
    await page.goto(`/treino/${workout.exerciseId}`);
    const practice = page.getByRole("button", { name: /Ir para a prática/ });
    await expect(practice).toBeVisible();
    await practice.click();
    const editorTab = page.getByRole("button", { name: "Editor", exact: true });
    if (await editorTab.isVisible()) await editorTab.click();
    const understood = page.getByRole("button", {
      name: "Entendi",
      exact: true,
    });
    if (await understood.isVisible()) await understood.click();
    await page.getByTitle("Salvar versão").click();
    await page.getByTitle("Abrir histórico de versões").click();
    await expect(
      page.getByRole("heading", { name: "Histórico de versões" }),
    ).toBeVisible();
    await expect(page.getByText("Salvamento manual")).toBeVisible();
  });

  test("glossário e busca global encontram conceitos reais", async ({
    page,
  }) => {
    await page.goto("/glossario");
    await page
      .locator('input[aria-label="Buscar no glossário"]:visible')
      .fill("condicional");
    await expect(
      page.getByRole("heading", { name: "Condicional" }),
    ).toBeVisible();

    await page.goto("/buscar");
    await page
      .getByRole("textbox", { name: "Busca global" })
      .fill("condicional");
    await expect(page.getByText("Condicional", { exact: true })).toBeVisible();
  });

  test("feedback do treino chega à triagem administrativa", async ({
    page,
  }) => {
    const workout = getDailyWorkout();
    await page.addInitScript(
      ({ email, startedOn }) => {
        localStorage.setItem(
          "logiclab-state-v2:e2e-admin",
          JSON.stringify({
            user: {
              accountId: "e2e-admin",
              name: "Aluno Feedback",
              email,
              role: "admin",
              trainingStartedOn: startedOn,
            },
          }),
        );
      },
      {
        email: `feedback-${Date.now()}@logiclab.dev`,
        startedOn: "2026-08-01",
      },
    );
    await page.goto(`/treino/${workout.exerciseId}`);
    const practice = page.getByRole("button", { name: /Ir para a prática/ });
    await expect(practice).toBeVisible();
    await practice.click();
    const editorTab = page.getByRole("button", { name: "Editor", exact: true });
    if (await editorTab.isVisible()) await editorTab.click();
    await page.getByRole("button", { name: "Avaliar" }).click();
    await page
      .getByLabel("Comentário opcional")
      .fill("Fluxo claro no teste E2E");
    await page.getByRole("button", { name: "Enviar feedback" }).click();
    await expect(page.getByText(/Feedback registrado/)).toBeVisible();

    await page.goto("/admin");
    await page.getByRole("button", { name: "Feedback", exact: true }).click();
    await expect(page.getByText("Fluxo claro no teste E2E")).toBeVisible();
  });

  test("feature flag desativa o Playground também no servidor", async ({
    page,
    request,
  }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Feature flags" }).click();
    const updateResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/features") &&
        response.request().method() === "PUT",
    );
    await page
      .locator(".feature-flags .preference-toggle")
      .filter({ hasText: "Playground" })
      .getByRole("checkbox")
      .uncheck();
    expect((await updateResponse).ok()).toBeTruthy();
    await expect
      .poll(async () => {
        const response = await request.get("/api/features");
        return (await response.json()).flags.PLAYGROUND;
      })
      .toBe(false);
    await page.goto("/playground");
    await expect(
      page.getByRole("heading", { name: /temporariamente indisponível/ }),
    ).toBeVisible();
    const restored = await request.put("/api/features", {
      headers: mutationHeaders,
      data: { key: "PLAYGROUND", enabled: true },
    });
    expect(restored.ok()).toBeTruthy();
  });
});
