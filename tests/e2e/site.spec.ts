import { finishDevelopmentVerification, testUsername } from "./auth-helpers";
import { expect, test, type Page } from "@playwright/test";
import { exercises } from "@/lib/content";
import {
  addDaysToDateKey,
  dailyWorkouts,
  getBrasiliaDateKey,
  getDailyWorkout,
  getUserDailyWorkout,
  getUserWorkoutSchedule,
  getWorkoutSchedule,
} from "@/lib/daily-workouts";
import { getProgressMetrics } from "@/lib/progress";
import {
  CORRECTION_UNLOCK_ATTEMPTS,
  isCorrectionUnlocked,
} from "@/lib/training-rules";

const routes = [
  "/",
  "/entrar",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/onboarding",
  "/dashboard",
  "/trilha",
  "/linguagens",
  "/habilidades",
  "/recompensas",
  "/praticar",
  "/laboratorio",
  "/playground",
  "/missoes",
  "/projetos",
  "/portfolio",
  "/evolucao",
  "/relatorio",
  "/prova",
  "/revisar",
  "/caderno",
  "/atividade",
  "/glossario",
  "/buscar",
  "/perfil",
  "/assinatura",
  "/seguranca",
  "/ajuda",
  "/manutencao",
  "/admin",
  "/termos",
  "/privacidade",
  "/treino/primeiros-passos",
  "/treino/tipos-de-dados",
  "/treino/operadores",
  "/treino/comparacoes",
  "/treino/repeticoes-iniciais",
  "/treino/arrays-iniciais",
  "/treino/funcoes-iniciais",
  "/treino/variaveis",
  "/treino/condicoes",
  "/treino/loops",
  "/treino/listas",
  "/treino/calculadora",
  "/treino/funcoes",
  "/treino/textos",
];

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon"))
      errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scroll,
    `horizontal overflow: ${dimensions.scroll - dimensions.width}px`,
  ).toBeLessThanOrEqual(dimensions.width + 2);
}

async function openMobileEditorIfNeeded(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) > 1100) return;
  const editorTab = page.getByRole("button", { name: "Editor", exact: true });
  await expect(editorTab).toBeVisible();
  await editorTab.click();
  await expect(page.locator(".code-panel")).toHaveClass(/mobile-active/);
}

async function openMobileTutorIfNeeded(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) > 1100) return;
  const tutorTab = page.getByRole("button", { name: "Tutor", exact: true });
  await expect(tutorTab).toBeVisible();
  await tutorTab.click();
  await expect(page.locator(".tutor-panel")).toHaveClass(/mobile-active/);
}

async function openWorkoutAsAdmin(page: Page, workoutId: string) {
  const workout = dailyWorkouts.find((candidate) => candidate.id === workoutId);
  if (!workout) throw new Error(`Treino desconhecido: ${workoutId}`);

  await page.goto("/admin");
  await page
    .getByLabel("Treino para visualizar")
    .filter({ visible: true })
    .first()
    .selectOption(workout.id);
  await page.getByRole("button", { name: "Visualizar como admin" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/treino/${workout.exerciseId}\\?modo=admin$`),
  );
  await expect(page.getByText(/Visualização administrativa/)).toBeVisible();
  await page.getByRole("button", { name: /Ir para a prática/ }).click();
}

async function ensureCorrectionUnlocked(page: Page, exerciseId: string) {
  const correction = page.getByRole("button", { name: /Entenda/ });
  if (await correction.isEnabled()) return;

  await openMobileEditorIfNeeded(page);
  const submit = page.getByRole("button", { name: "Enviar resposta" });
  for (let index = 0; index < CORRECTION_UNLOCK_ATTEMPTS; index += 1) {
    if (await correction.isEnabled()) break;
    const previousAttempts = await page.evaluate((id) => {
      const stored = JSON.parse(
        localStorage.getItem("logiclab-state-v2:e2e-admin") ?? "{}",
      );
      return stored.attempts?.[id] ?? 0;
    }, exerciseId);
    await submit.click();
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const stored = JSON.parse(
            localStorage.getItem("logiclab-state-v2:e2e-admin") ?? "{}",
          );
          return stored.attempts?.[id] ?? 0;
        }, exerciseId),
      )
      .toBeGreaterThan(previousAttempts);
  }
  await expect(correction).toBeEnabled();
  if ((page.viewportSize()?.width ?? 1440) <= 1100) {
    await page.getByRole("button", { name: "Enunciado", exact: true }).click();
  }
}

async function replaceEditorCode(page: Page, code: string) {
  await page.locator(".view-lines").click({ position: { x: 120, y: 35 } });
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(code);
  if (code.trimEnd().endsWith("}")) {
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Backspace");
  }
}

test.describe("integridade global", () => {
  for (const route of routes) {
    test(`${route} carrega, recarrega e não transborda`, async ({ page }) => {
      const errors = collectRuntimeErrors(page);
      const response = await page.goto(route);
      expect(
        response?.ok(),
        `${route} HTTP ${response?.status()}`,
      ).toBeTruthy();
      await expect(page.locator("body")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.reload();
      await expect(page.locator("body")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  test("API de status responde e rota desconhecida mostra 404", async ({
    request,
    page,
  }) => {
    const response = await request.get("/api/status");
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({
      status: "ok",
      app: "LogicLab",
    });
    await page.goto("/rota-inexistente");
    await expect(
      page.getByRole("heading", { name: "Essa rota não existe." }),
    ).toBeVisible();
  });

  test("todos os destinos internos expostos respondem", async ({
    page,
    request,
  }) => {
    const destinations = new Set<string>();
    for (const route of routes) {
      await page.goto(route);
      const hrefs = await page
        .locator('a[href^="/"]')
        .evaluateAll((links) =>
          links
            .map((link) => link.getAttribute("href"))
            .filter((href): href is string => Boolean(href)),
        );
      hrefs.forEach((href) => destinations.add(href));
    }

    for (const href of destinations) {
      const response = await request.get(href);
      expect(response.status(), href).toBeLessThan(400);
    }
  });
});

test.describe("landing page", () => {
  test("landing compacta oferece FAQ e cadastro direto", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Aprenda programação",
    );
    await expect(page.locator("main section")).toHaveCount(6);
    const faq = page.locator("details").first();
    await faq.locator("summary").click();
    await expect(faq).toHaveAttribute("open", "");
    await page
      .getByRole("link", { name: "Começar grátis", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/cadastro$/);
  });

  test("todos os links internos da landing respondem", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((links) => [
        ...new Set(
          links
            .map((link) => link.getAttribute("href"))
            .filter((href): href is string =>
              Boolean(href && href.startsWith("/") && href !== "/"),
            ),
        ),
      ]);
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), href).toBeLessThan(400);
    }
  });
});

test.describe("acesso e onboarding", () => {
  test("login, recuperação e persistência", async ({ page, isMobile }) => {
    const email = `alex-${Date.now()}@logiclab.dev`;
    const password = "SenhaSegura123";
    await page.goto("/entrar");
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await expect(page).toHaveURL(/\/recuperar-senha$/);
    await page.goto("/cadastro");
    await page
      .getByPlaceholder("Como podemos chamar você?")
      .fill("Alex Seguro");
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
    await page.getByRole("button", { name: "Pular por agora" }).click();
    if (isMobile)
      await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    if (await page.getByLabel("Username", { exact: true }).count())
      await page
        .getByLabel("Username", { exact: true })
        .fill(testUsername(email));
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: /^entrar/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.reload();
    if (isMobile)
      await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(
      page.getByRole("link", { name: /Alex Seguro Plano gratuito/ }),
    ).toBeVisible();
  });

  test("cadastro e onboarding completo persistem", async ({ page }) => {
    const email = `maria-${Date.now()}@teste.dev`;
    await page.goto("/cadastro");
    await page
      .getByPlaceholder("Como podemos chamar você?")
      .fill("Maria Silva");
    await page.getByLabel("E-mail").fill(email);
    if (await page.getByLabel("Username", { exact: true }).count())
      await page
        .getByLabel("Username", { exact: true })
        .fill(testUsername(email));
    await page.getByLabel("Senha", { exact: true }).fill("SenhaSegura123");
    await page.getByLabel("Confirmar senha").fill("SenhaSegura123");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /criar conta/i }).click();
    await finishDevelopmentVerification(page);
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("button", { name: /Nunca/ }).click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByRole("button", { name: /Melhorar minha lógica/ }).click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByRole("button", { name: /30 minutos/ }).click();
    await page.getByRole("button", { name: /Preparar meu treino/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Maria/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: /Maria/ })).toBeVisible();
  });
});

test.describe("área do aluno", () => {
  test("menu, notificações, tema e rotas principais", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/dashboard");
    if (isMobile)
      await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .getByRole("navigation", { name: "Área do aluno", exact: true })
      .getByRole("link", { name: "Minha trilha", exact: true })
      .click();
    await expect(page).toHaveURL(/\/trilha$/);
    if (isMobile)
      await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("link", { name: "Início", exact: true }).click();
    await page.getByRole("button", { name: "Notificações" }).click();
    await expect(
      page.getByText(/Nenhuma notificação|Treino \d+ está pronto/),
    ).toBeVisible();
    const theme = page.getByRole("button", { name: /Ativar tema claro/ });
    if (await theme.count()) await theme.click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("caderno salva nota, alterna abas e persiste no reload", async ({
    page,
  }) => {
    await page.goto("/caderno");
    const note = page.getByPlaceholder("Adicionar uma anotação...").first();
    await note.fill("Revisar o valor limite antes do desafio.");
    await page.reload();
    await expect(
      page.getByPlaceholder("Adicionar uma anotação...").first(),
    ).toHaveValue("Revisar o valor limite antes do desafio.");
    await page.getByRole("button", { name: /Anotações/ }).click();
    await expect(page.locator("textarea").first()).toBeVisible();
    await page.getByRole("button", { name: /Para revisar/ }).click();
    await expect(page.locator(".notebook-card").first()).toBeVisible();
  });

  test("perfil salva preferências e checkout não simula assinatura", async ({
    page,
  }) => {
    await page.goto("/perfil");
    await page.getByLabel("Nome").filter({ visible: true }).fill("Alex Teste");
    await page
      .getByLabel("Meta diária")
      .filter({ visible: true })
      .selectOption("30");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Nome").filter({ visible: true })).toHaveValue(
      "Alex Teste",
    );
    const avatarInput = page.locator('.standard-page input[type="file"]');
    await avatarInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.getByText("Foto atualizada.")).toBeVisible();
    await page.reload();
    await expect(
      page.locator(".profile-avatar").filter({ visible: true }),
    ).toHaveClass(/has-image/);
    await page.goto("/planos");
    await page.getByRole("button", { name: /ASSINAR PREMIUM/ }).click();
    await expect(page).toHaveURL(/\/entrar\?next=%2Fplanos/i);
    await page.goto("/planos");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Free", exact: true }),
    ).toBeVisible();
    await page.goto("/linguagens");
    await expect(page.locator(".language-card.locked")).toHaveCount(4);
  });

  test("escala da interface e fonte do editor persistem", async ({ page }) => {
    await page.goto("/perfil");
    const interfaceSize = page
      .getByLabel("Tamanho da interface")
      .filter({ visible: true })
      .first();
    await interfaceSize.selectOption("compact");
    await expect(page.locator("html")).toHaveAttribute(
      "data-interface-size",
      "compact",
    );
    await interfaceSize.selectOption("standard");
    await expect(page.locator("html")).toHaveAttribute(
      "data-interface-size",
      "standard",
    );
    await interfaceSize.selectOption("large");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
      "data-interface-size",
      "large",
    );

    await openWorkoutAsAdmin(page, "treino-08");
    await openMobileEditorIfNeeded(page);
    await expect(page.locator(".monaco-editor")).toBeVisible({
      timeout: 15_000,
    });
    await page
      .getByRole("button", { name: "Aumentar fonte do editor" })
      .click();
    await expect(page.locator(".view-lines")).toHaveCSS("font-size", "17px");
    await page.reload();
    await openMobileEditorIfNeeded(page);
    await expect(page.locator(".view-lines")).toHaveCSS("font-size", "17px");

    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(viewport).toContain("maximum-scale=5");
    expect(viewport).not.toContain("user-scalable=no");
  });

  test("preferências do plano persistem sem sobrecarregar o dashboard", async ({
    page,
  }) => {
    await page.goto("/perfil");
    await page
      .getByLabel("Dias de estudo por semana")
      .filter({ visible: true })
      .first()
      .selectOption("3");
    await page
      .getByLabel("Foco principal do plano")
      .filter({ visible: true })
      .first()
      .selectOption("Debugging");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Alterações salvas")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.locator(".dashboard-study-plan")).toHaveCount(0);
    await page.goto("/perfil");
    await page.reload();
    await expect(
      page
        .getByLabel("Dias de estudo por semana")
        .filter({ visible: true })
        .first(),
    ).toHaveValue("3");
    await expect(
      page
        .getByLabel("Foco principal do plano")
        .filter({ visible: true })
        .first(),
    ).toHaveValue("Debugging");
  });
});

test.describe("treino e editor", () => {
  test("correção exige três tentativas", () => {
    expect(isCorrectionUnlocked(0)).toBe(false);
    expect(isCorrectionUnlocked(2)).toBe(false);
    expect(isCorrectionUnlocked(3)).toBe(true);
    expect(isCorrectionUnlocked(4)).toBe(true);
  });

  test("cada número abre conteúdo próprio e correspondente ao tópico", async ({
    page,
  }) => {
    await openWorkoutAsAdmin(page, "treino-03");

    await page.getByRole("button", { name: /Aprenda/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "Operadores: calculando resultados",
      }),
    ).toBeVisible();
    await expect(page.locator(".concept-example")).toContainText(
      "calcular(5, 3, '+')",
    );
    await expect(page.locator(".concept-example")).toContainText("8");

    await page.getByRole("button", { name: /Pratique/ }).click();
    await expect(page.locator(".workspace-shell")).toBeVisible();
    const correction = page.getByRole("button", { name: /Entenda/ });
    const attemptsBeforeUnlock = await page.evaluate(() => {
      const stored = JSON.parse(
        localStorage.getItem("logiclab-state-v2:e2e-admin") ?? "{}",
      );
      return stored.attempts?.operadores ?? 0;
    });
    if (attemptsBeforeUnlock < CORRECTION_UNLOCK_ATTEMPTS) {
      await expect(correction).toBeDisabled();
    }
    await ensureCorrectionUnlocked(page, "operadores");

    await page.getByRole("button", { name: /Desafie-se/ }).click();
    await expect(page.locator(".workspace-shell")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Desafio final: Operadores na prática",
      }),
    ).toBeVisible();
    await expect(page.locator(".challenge-stage")).toContainText(
      "Combinar funções e condições em uma calculadora simples.",
    );
    await expect(
      page.locator(".challenge-stage .stage-criteria-list li"),
    ).toHaveCount(5);
    await expectNoHorizontalOverflow(page);

    await correction.click();
    await expect(page.locator(".workspace-shell")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Entenda Operadores passo a passo",
      }),
    ).toBeVisible();
    await expect(page.locator(".understand-stage")).toContainText(
      "cada operação vira um caso independente",
    );
    await expect(page.locator(".reference-solution pre")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("dica, favorito, execução, testes, fullscreen e autosave", async ({
    page,
  }) => {
    await openWorkoutAsAdmin(page, "treino-08");
    await page.getByRole("button", { name: /Ver dica 1/ }).click();
    await expect(page.getByText("DICA 1", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Favoritar exercício" }).click();
    await openMobileEditorIfNeeded(page);
    await expect(page.locator(".monaco-editor")).toBeVisible({
      timeout: 15_000,
    });
    await replaceEditorCode(
      page,
      'function avaliarNota(nota) {\n  return nota >= 7 ? "Aprovado" : "Reprovado";',
    );
    await page.getByRole("button", { name: "Executar", exact: true }).click();
    await expect(page.getByText(/Resultado: Aprovado/i)).toBeVisible();
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText("Todos os testes passaram!")).toBeVisible();
    await expect(page.getByText(/Exercício concluído/)).toBeVisible();
    await openMobileTutorIfNeeded(page);
    await expect(page.getByText(/todos os cenários passaram/i)).toBeVisible();
    await openMobileEditorIfNeeded(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem("logiclab-state-v2:e2e-admin") ?? "{}",
            ).drafts?.condicoes ?? "",
        ),
      )
      .toContain("return nota >= 7");
    await page.getByRole("button", { name: "Expandir editor" }).click();
    await expect(page.locator(".code-panel")).toHaveClass(/editor-expanded/);
    await page.getByRole("button", { name: "Reduzir editor" }).click();
    await page.reload();
    await openMobileEditorIfNeeded(page);
    await expect(page.locator(".monaco-editor")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".view-lines")).toContainText("return nota >= 7");

    await page.goto("/dashboard");
    const storedState = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("logiclab-state-v2:e2e-admin") ?? "{}"),
    );
    const metrics = getProgressMetrics(storedState);
    const metricCard = (label: string) =>
      page
        .locator(".metric-card")
        .filter({ hasText: label })
        .filter({ visible: true });
    await expect(metricCard("Sequência atual").locator("strong")).toHaveText(
      `${metrics.streak} dias`,
    );
    await expect(metricCard("Sequência atual")).toContainText(
      `Recorde: ${metrics.longestStreak} dias`,
    );
    await expect(metricCard("XP total").locator("strong")).toHaveText(
      String(metrics.xp),
    );
    await expect(metricCard("Exercícios").locator("strong")).toHaveText(
      String(metrics.completedCount),
    );
    await expect(
      metricCard("Progresso da trilha").locator("strong"),
    ).toHaveText(`${metrics.progressPercent}%`);

    expect(
      storedState.xpTransactions.filter(
        (transaction: { uniqueKey: string }) =>
          transaction.uniqueKey === "exercise:condicoes:completion",
      ),
    ).toHaveLength(1);

    await page.goto("/recompensas");
    await expect(page.getByText("exercise:condicoes:completion")).toBeVisible();
    await page.reload();
    await expect(page.getByText("exercise:condicoes:completion")).toBeVisible();

    await page.goto("/perfil");
    const profileStats = page
      .locator(".profile-stats")
      .filter({ visible: true });
    await expect(profileStats).toContainText(String(metrics.xp));
    await expect(profileStats).toContainText(String(metrics.streak));
    await expect(profileStats).toContainText(String(metrics.completedCount));
  });

  test("editor, console e ações ficam acessíveis sem rolar a página", async ({
    page,
  }) => {
    await openWorkoutAsAdmin(page, "treino-08");
    await openMobileEditorIfNeeded(page);
    await expect(page.locator(".monaco-editor")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: "Executar", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Enviar resposta" }),
    ).toBeInViewport();
    await expect(page.locator(".editor-actions")).toBeInViewport();
    await expect(page.locator(".console-panel")).toBeInViewport();
    await expect(page.getByRole("button", { name: /Testes/ })).toBeInViewport();
    const pageBeforeTutor = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      scrollY: window.scrollY,
    }));
    if ((page.viewportSize()?.width ?? 1440) > 1100) {
      expect(pageBeforeTutor.scrollY).toBe(0);
    }

    await openMobileTutorIfNeeded(page);
    const tutorLog = page.getByRole("log", {
      name: "Mensagens do Tutor — área rolável",
    });
    await expect(tutorLog).toBeInViewport();
    expect(
      await tutorLog.evaluate((element) => getComputedStyle(element).overflowY),
    ).toBe("auto");
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(pageBeforeTutor.height);
  });

  test("tutor varia a redação e mantém as mensagens em rolagem interna", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "O conteúdo é validado uma vez; o encaixe responsivo tem teste próprio.",
    );
    await openWorkoutAsAdmin(page, "treino-08");
    await openMobileTutorIfNeeded(page);

    const conversation = page.getByRole("log", {
      name: "Mensagens do Tutor — área rolável",
    });
    await expect(conversation).toBeVisible();
    const initialDocumentHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    const tutorReplies = page.locator(
      ".tutor-message.tutor:not(.tutor-thinking) p",
    );
    const replies: string[] = [];

    for (let index = 0; index < 5; index += 1) {
      const previousReplyCount = await tutorReplies.count();
      await page
        .getByPlaceholder("Pergunte sobre sua lógica...")
        .fill("Qual é o comportamento esperado?");
      await page
        .getByRole("button", { name: "Enviar pergunta ao tutor" })
        .click();
      await expect(tutorReplies).toHaveCount(previousReplyCount + 1);
      const reply = await tutorReplies.last().innerText();
      replies.push(reply);
    }

    expect(new Set(replies).size).toBe(replies.length);
    expect(replies.every((reply) => reply.includes("nota"))).toBe(true);
    const layout = await conversation.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    }));
    expect(layout.overflowY).toBe("auto");
    expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(initialDocumentHeight);
  });

  test("limpar restaura o código inicial e erros são didáticos", async ({
    page,
  }) => {
    await openWorkoutAsAdmin(page, "treino-08");
    await openMobileEditorIfNeeded(page);
    await expect(page.locator(".monaco-editor")).toBeVisible({
      timeout: 15_000,
    });
    await replaceEditorCode(page, "function avaliarNota( {");
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText(/erro de sintaxe/i).first()).toBeVisible();
    await openMobileTutorIfNeeded(page);
    await expect(page.getByText(/erro de sintaxe/i).last()).toBeVisible();
    await openMobileEditorIfNeeded(page);
    await page.getByRole("button", { name: "Limpar", exact: true }).click();
    await expect(page.locator(".monaco-editor")).toContainText(
      "function avaliarNota",
    );
  });

  test("entrada, tutor contextual e histórico persistente funcionam", async ({
    page,
  }) => {
    await openWorkoutAsAdmin(page, "treino-08");
    await openMobileEditorIfNeeded(page);
    await expect(page.locator(".monaco-editor")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel("Nota para testar").fill("7");
    await replaceEditorCode(
      page,
      'function avaliarNota(nota) {\n  return nota > 7 ? "Aprovado" : "Reprovado";',
    );
    await page.getByRole("button", { name: "Executar", exact: true }).click();
    await expect(page.getByText(/Resultado: Reprovado/i)).toBeVisible();
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText("3 de 4 testes passaram")).toBeVisible();

    await openMobileTutorIfNeeded(page);
    await expect(
      page
        .locator(".tutor-message.tutor p")
        .filter({ hasText: /operador.*7|igualdade|incluir.*valor/i })
        .last(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Analise minha lógica" }).click();
    await expect(
      page
        .locator(".tutor-message.student p", {
          hasText: "Analise minha lógica",
        })
        .last(),
    ).toBeVisible();
    await page
      .getByPlaceholder("Pergunte sobre sua lógica...")
      .fill("Por que o limite importa?");
    await page
      .getByRole("button", { name: "Enviar pergunta ao tutor" })
      .click();
    const thinkingDots = page.locator(".tutor-thinking-bubble > span");
    await expect(
      page.getByRole("status", { name: "Tutor pensando" }),
    ).toBeVisible();
    await expect(thinkingDots).toHaveCount(3);
    await expect(thinkingDots.first()).toHaveCSS(
      "animation-name",
      "tutor-dot-pulse",
    );
    await expect(
      page
        .locator(".tutor-message.tutor p")
        .filter({
          hasText: /comportamento esperado|resultado esperado|referência/i,
        })
        .last(),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Tutor pensando" }),
    ).toHaveCount(0);

    await page.getByText(/Histórico de tentativas/).click();
    await expect(page.getByText(/Tentativa \d+/).first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const data = JSON.parse(
            localStorage.getItem("logiclab-state-v2:e2e-admin") ?? "{}",
          );
          const attempt = data.attemptHistory?.at(-1);
          return {
            code: attempt?.code,
            passedTests: attempt?.passedTests,
            failedTests: attempt?.failedTests,
            attemptNumber: attempt?.attemptNumber,
            hintsUsed: attempt?.hintsUsed,
          };
        }),
      )
      .toMatchObject({
        code: expect.stringContaining("nota > 7"),
        passedTests: 3,
        failedTests: 1,
        attemptNumber: expect.any(Number),
        hintsUsed: 0,
      });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<number>((resolve, reject) => {
              const request = indexedDB.open("logiclab-training-v2:e2e-admin");
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const database = request.result;
                const count = database
                  .transaction("attempts", "readonly")
                  .objectStore("attempts")
                  .count();
                count.onsuccess = () => {
                  database.close();
                  resolve(count.result);
                };
                count.onerror = () => reject(count.error);
              };
            }),
        ),
      )
      .toBeGreaterThan(0);

    await page.reload();
    await openMobileTutorIfNeeded(page);
    await expect(
      page.getByText("Por que o limite importa?", { exact: true }),
    ).toBeVisible();
  });

  test("todos os níveis de ajuda do tutor respondem sem entregar a solução cedo", async ({
    page,
  }) => {
    await openWorkoutAsAdmin(page, "treino-08");
    await openMobileTutorIfNeeded(page);

    await page.getByRole("button", { name: "Me dê uma dica" }).click();
    await expect(
      page
        .locator(".tutor-message.tutor p")
        .filter({
          hasText: /alteração|ajuste|menor mudança|operador.*7|igualdade/i,
        })
        .last(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Explique meu erro" }).click();
    await expect(
      page
        .locator(".tutor-message.student p", {
          hasText: "Explique meu erro",
        })
        .last(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Analise minha lógica" }).click();
    await expect(
      page
        .locator(".tutor-message.tutor p")
        .filter({
          hasText:
            /envie a resposta|validarmos os casos|próximo passo|operador.*7|igualdade/i,
        })
        .last(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Não entendi" }).click();
    await expect(
      page
        .locator(".tutor-message.tutor p")
        .filter({
          hasText:
            /reduzir o problema|separar o exercício|tornar isso menor|operador.*7|igualdade/i,
        })
        .last(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Como liberar a solução?" }).click();
    await expect(
      page
        .locator(".tutor-message.tutor p")
        .filter({
          hasText:
            /preservar seu raciocínio|solução completa ainda|código pronto/i,
        })
        .last(),
    ).toBeVisible();
    await expect(
      page.locator(".tutor-message.tutor p").filter({
        hasText: "function avaliarNota",
      }),
    ).toHaveCount(0);
  });

  test("solução completa só é liberada após pistas e tentativas", async ({
    page,
  }) => {
    await openWorkoutAsAdmin(page, "treino-08");
    await openMobileTutorIfNeeded(page);
    const hint = page.getByRole("button", { name: "Me dê uma dica" });
    await hint.click();
    await hint.click();
    await hint.click();

    await openMobileEditorIfNeeded(page);
    await expect(page.locator(".monaco-editor")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByText(/testes passaram/)).toBeVisible();
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await page.getByRole("button", { name: "Enviar resposta" }).click();

    await openMobileTutorIfNeeded(page);
    const solutionButton = page.getByRole("button", {
      name: "Pedir solução completa",
    });
    await expect(solutionButton).toBeVisible();
    await solutionButton.click();
    await expect(
      page.locator(".tutor-message.tutor p").filter({
        hasText: "function avaliarNota(nota)",
      }),
    ).toBeVisible();
    await expect(
      page
        .locator(".tutor-message.tutor p")
        .filter({
          hasText:
            /solução possível|implementação possível|resposta completa|forma válida/,
        })
        .filter({ hasText: "nota >= 7" }),
    ).toBeVisible();
  });

  test("treinos 01 a 07 possuem exercícios funcionais completos", async ({
    page,
  }) => {
    const cases = dailyWorkouts.slice(0, 7).map((workout) => ({
      workoutId: workout.id,
      code: exercises.find((exercise) => exercise.id === workout.exerciseId)!
        .solution,
    }));

    for (const item of cases) {
      await openWorkoutAsAdmin(page, item.workoutId);
      await openMobileEditorIfNeeded(page);
      await expect(page.locator(".monaco-editor")).toBeVisible({
        timeout: 15_000,
      });
      await replaceEditorCode(page, item.code);
      await page.getByRole("button", { name: "Enviar resposta" }).click();
      await expect(page.getByText("Todos os testes passaram!")).toBeVisible();
    }
  });
});

test.describe("programação diária", () => {
  test("XP, sequência, recorde, progresso e concluídos vêm da mesma fonte", () => {
    const metrics = getProgressMetrics(
      {
        completedExercises: ["variaveis", "condicoes", "variaveis", "inválido"],
        activeDays: [
          "2026-08-01",
          "2026-08-02",
          "2026-08-04",
          "2026-08-05",
          "2026-08-06",
          "2026-08-14",
        ],
        xpTransactions: [
          {
            id: "xp-variaveis",
            amount: 10,
            reason: "exercise_completion",
            uniqueKey: "exercise:variaveis:completion",
            exerciseId: "variaveis",
            description: "Conclusão de Variáveis",
            createdAt: "2026-08-01T12:00:00.000Z",
          },
          {
            id: "xp-condicoes",
            amount: 25,
            reason: "exercise_completion",
            uniqueKey: "exercise:condicoes:completion",
            exerciseId: "condicoes",
            description: "Conclusão de Condições",
            createdAt: "2026-08-14T12:00:00.000Z",
          },
        ],
      },
      new Date("2026-08-15T15:00:00Z"),
    );

    expect(metrics).toEqual({
      xp: 35,
      completedCount: 2,
      totalExercises: 14,
      progressPercent: 14,
      streak: 1,
      longestStreak: 3,
    });
  });

  test("os 14 treinos seguem datas e virada do dia no horário de Brasília", () => {
    const days = Array.from(
      { length: 14 },
      (_, index) =>
        getDailyWorkout(
          new Date(`2026-08-${String(7 + index).padStart(2, "0")}T15:00:00Z`),
        ).day,
    );
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(getDailyWorkout(new Date("2026-08-21T15:00:00Z")).day).toBe(1);
    expect(getBrasiliaDateKey(new Date("2026-08-15T02:59:59Z"))).toBe(
      "2026-08-14",
    );
    expect(getDailyWorkout(new Date("2026-08-15T02:59:59Z")).day).toBe(8);
    expect(getDailyWorkout(new Date("2026-08-15T03:00:00Z")).day).toBe(9);

    const schedule = getWorkoutSchedule(new Date("2026-08-15T15:00:00Z"));
    expect(schedule[0].dateKey).toBe("2026-08-07");
    expect(schedule[7].dateKey).toBe("2026-08-14");
    expect(schedule[13].dateKey).toBe("2026-08-20");
    expect(schedule.filter((workout) => workout.isCurrent)).toHaveLength(1);
  });

  test("cada usuário começa no treino 1 e recebe um novo por dia", () => {
    const startedOn = "2026-08-15";
    expect(
      getUserDailyWorkout(startedOn, new Date("2026-08-15T15:00:00Z")).day,
    ).toBe(1);
    expect(
      getUserDailyWorkout(startedOn, new Date("2026-08-16T02:59:59Z")).day,
    ).toBe(1);
    expect(
      getUserDailyWorkout(startedOn, new Date("2026-08-16T03:00:00Z")).day,
    ).toBe(2);
    expect(
      getUserDailyWorkout(startedOn, new Date("2026-08-29T15:00:00Z")).day,
    ).toBe(1);

    const schedule = getUserWorkoutSchedule(
      startedOn,
      new Date("2026-08-17T15:00:00Z"),
    );
    expect(schedule.slice(0, 3).every((workout) => workout.isUnlocked)).toBe(
      true,
    );
    expect(schedule.slice(3).every((workout) => !workout.isUnlocked)).toBe(
      true,
    );
    expect(schedule[0].dateKey).toBe("2026-08-15");
    expect(schedule[1].dateKey).toBe("2026-08-16");
    expect(schedule[2].dateKey).toBe("2026-08-17");
  });

  test("primeiro login atribui o treino 1", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByPlaceholder("Como podemos chamar você?").fill("Novo Aluno");
    await page.getByLabel("E-mail").fill(`novo-${Date.now()}@logiclab.dev`);
    await page.getByLabel("Senha", { exact: true }).fill("SenhaSegura123");
    await page.getByLabel("Confirmar senha").fill("SenhaSegura123");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /criar conta/i }).click();
    await finishDevelopmentVerification(page);
    await page.getByRole("button", { name: "Pular por agora" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.locator(".daily-workout-card.current .daily-workout-number"),
    ).toHaveText("01");
    await expect(page.locator(".daily-workout-card.available")).toHaveCount(0);
    await expect(page.locator(".daily-workout-card.locked")).toHaveCount(13);
  });

  test("aluno acessa o treino atual e os anteriores; admin pré-visualiza os futuros", async ({
    page,
  }) => {
    const startedOn = addDaysToDateKey(getBrasiliaDateKey(), -2);
    await page.addInitScript(
      ({ email, startedOn }) => {
        localStorage.setItem(
          "logiclab-state-v2:e2e-admin",
          JSON.stringify({
            user: {
              accountId: "e2e-admin",
              name: "Aluno Isolado",
              email,
              role: "admin",
              trainingStartedOn: startedOn,
            },
          }),
        );
      },
      {
        email: `isolado-${Date.now()}@logiclab.dev`,
        startedOn,
      },
    );
    const currentWorkout = getUserDailyWorkout(startedOn);
    const schedule = getUserWorkoutSchedule(startedOn);
    const availableWorkout = schedule.find(
      (workout) => workout.isUnlocked && !workout.isCurrent,
    )!;
    const lockedWorkout = schedule.find((workout) => !workout.isUnlocked)!;
    const availableCount = schedule.filter(
      (workout) => workout.isUnlocked && !workout.isCurrent,
    ).length;
    const lockedCount = schedule.filter(
      (workout) => !workout.isUnlocked,
    ).length;

    await page.goto("/dashboard");
    await expect(page.locator(".daily-workout-card")).toHaveCount(14);
    await expect(page.locator(".daily-workout-card.current")).toHaveCount(1);
    await expect(page.locator(".daily-workout-card.available")).toHaveCount(
      availableCount,
    );
    await expect(page.locator(".daily-workout-card.locked")).toHaveCount(
      lockedCount,
    );
    await page
      .locator(`a[href="/treino/${availableWorkout.exerciseId}"]`)
      .last()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/treino/${availableWorkout.exerciseId}$`),
    );

    await page.goto("/dashboard");
    const currentCard = page
      .locator(".daily-workout-card.current")
      .filter({ visible: true });
    await expect(currentCard).toHaveAttribute(
      "href",
      `/treino/${currentWorkout.exerciseId}`,
    );
    await currentCard.click();
    await expect(page).toHaveURL(
      new RegExp(`/treino/${currentWorkout.exerciseId}$`),
    );
    await expect(
      page.getByRole("heading", { name: currentWorkout.title }),
    ).toBeVisible();

    await page.goto(`/treino/${lockedWorkout.exerciseId}`);
    await expect(
      page.getByRole("heading", {
        name: "Este treino está bloqueado para o aluno.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ir para o treino de hoje" }),
    ).toHaveAttribute("href", `/treino/${currentWorkout.exerciseId}`);

    await openWorkoutAsAdmin(page, lockedWorkout.id);
    await expect(
      page.getByText(
        `Visualização administrativa · Treino ${lockedWorkout.day}`,
      ),
    ).toBeVisible();
    await page.getByRole("link", { name: "Voltar ao painel" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(`/treino/${lockedWorkout.exerciseId}`);
    await expect(
      page.getByRole("heading", {
        name: "Este treino está bloqueado para o aluno.",
      }),
    ).toBeVisible();
  });
});

test.describe("admin", () => {
  test("cria, busca, edita, publica e exclui conteúdo", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Novo conteúdo" }).click();
    await page
      .getByPlaceholder(/Comparando duas idades/)
      .fill("Exercício automatizado");
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await expect(page.getByText("Exercício automatizado")).toBeVisible();
    await page.getByPlaceholder("Buscar conteúdo").fill("automatizado");
    await expect(page.locator(".table-row")).toHaveCount(1);
    await page
      .getByRole("button", { name: /Editar Exercício automatizado/ })
      .click();
    await page.getByLabel("Título").fill("Exercício editado");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page.getByPlaceholder("Buscar conteúdo").fill("");
    await expect(page.getByText("Exercício editado")).toBeVisible();
    await page
      .getByRole("button", { name: /Duplicar Exercício editado/ })
      .click();
    await expect(page.getByText("Exercício editado (cópia)")).toBeVisible();
    const editedRow = page
      .locator(".table-row")
      .filter({ hasText: "Exercício editado" })
      .first();
    await editedRow.getByRole("button", { name: "Rascunho" }).click();
    await expect(
      editedRow.getByRole("button", { name: "Publicado" }),
    ).toBeVisible();
    await editedRow.getByRole("button", { name: "Excluir" }).click();
    await expect(
      page.getByText("Exercício editado", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /Usuários/ }).click();
    await expect(page.getByText("aluno@demo.dev")).toBeVisible();
    await page
      .getByRole("button", { name: "Assinaturas", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Assinaturas", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Nenhuma assinatura registrada")).toBeVisible();
    await page.getByRole("button", { name: /Configurações/ }).click();
    await expect(page.getByText("Configurações centralizadas")).toBeVisible();
  });
});

test("barra lateral preserva a posição ao navegar", async ({
  page,
  isMobile,
}) => {
  await page.goto("/dashboard");
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }

  const sidebar = page.getByRole("navigation", { name: "Área do aluno" });
  const destination = sidebar.getByRole("link", { name: "Minha atividade" });
  await destination.scrollIntoViewIfNeeded();
  const positionBeforeNavigation = await sidebar.evaluate(
    (element) => element.scrollTop,
  );
  expect(positionBeforeNavigation).toBeGreaterThan(0);

  await destination.evaluate((element) =>
    (element as HTMLAnchorElement).click(),
  );
  await expect(page).toHaveURL(/\/atividade$/);
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }

  await expect
    .poll(() => sidebar.evaluate((element) => element.scrollTop))
    .toBe(positionBeforeNavigation);
});

test.describe("auditoria adicional de botões", () => {
  test("controles secundários respondem e navegam corretamente", async ({
    page,
  }) => {
    await page.goto("/entrar");
    const password = page.locator('input[minlength="10"]');
    await expect(password).toHaveAttribute("type", "password");
    await page
      .getByRole("button", { name: "Mostrar ou ocultar senha" })
      .click();
    await expect(password).toHaveAttribute("type", "text");

    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Pular por agora" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/perfil");
    const name = page.getByLabel("Nome").filter({ visible: true }).first();
    await name.fill("Nome temporário");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page.getByRole("button", { name: "Reiniciar dados" }).click();
    await expect(name).toHaveValue("Administrador de teste");

    await page.goto("/admin");
    await page.getByRole("button", { name: "Novo conteúdo" }).click();
    await expect(
      page.getByRole("dialog", { name: "Novo conteúdo" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fechar janela" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Novo conteúdo" }).click();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await openWorkoutAsAdmin(page, "treino-08");
    await ensureCorrectionUnlocked(page, "condicoes");
    const challenge = page.getByRole("button", { name: /Desafie-se/ });
    await challenge.click();
    await expect(challenge).toHaveClass(/active/);
    const understand = page.getByRole("button", { name: /Entenda/ });
    await understand.click();
    await expect(understand).toHaveClass(/active/);
    await page.getByRole("button", { name: /Aprenda/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "Condições: ensinando o código a decidir",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Pratique/ }).click();
    await expect(
      page.getByRole("heading", { name: "Decisões no código" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Sair do treino" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test("todos os botões visíveis têm nome acessível", async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const unnamed = await page
      .locator("button:visible")
      .evaluateAll(
        (buttons) =>
          buttons.filter(
            (button) =>
              !(
                button.getAttribute("aria-label") ||
                button.textContent?.trim() ||
                button.getAttribute("title")
              ),
          ).length,
      );
    expect(unnamed, `${route} possui botões sem nome`).toBe(0);
  }
});
