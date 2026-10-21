import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { authHeaders, verifyDevelopmentSignup } from "./auth-helpers";

const password = "DashboardSecurePassword123";
async function register(request: APIRequestContext, name: string) {
  const suffix = randomBytes(6).toString("hex");
  const input = {
    name,
    username: `dash_${suffix}`,
    email: `${suffix}@example.test`,
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
  await verifyDevelopmentSignup(request, payload);
  expect(
    (
      await request.post("/api/profile/onboarding", {
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
  return { input, account: payload.account };
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
async function submit(
  request: APIRequestContext,
  exerciseId: string,
  code: string,
) {
  const response = await request.post("/api/attempts", {
    headers: authHeaders,
    data: {
      exerciseId,
      code,
      activityMode: "path",
      idempotencyKey: randomUUID(),
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}
async function logout(page: Page) {
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page).toHaveURL("http://127.0.0.1:3208/");
}

test("new dashboard uses the real account, empty states and four priority destinations", async ({
  page,
}) => {
  await register(page.request, "Lívia Iniciante");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Olá, Lívia.",
  );
  await expect(
    page.getByRole("link", {
      name: "Começar minha primeira aula",
      exact: true,
    }),
  ).toHaveAttribute("href", "/treino/primeiros-passos");
  await expect(page.getByTestId("dashboard-xp")).toHaveText("0 XP");
  await expect(
    page.getByText("Nenhuma atividade registrada ainda."),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Progresso da trilha" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(
    page.locator(
      ".demo-notice, .heatmap, .week-dots, .nav-badge, .review-card, .daily-goal",
    ),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      /Alex|Ambiente de demonstração|Prioridade alta|Revisão inteligente/i,
    ),
  ).toHaveCount(0);
  const main = page.getByRole("group", {
    name: "Navegação principal",
    exact: true,
  });
  await expect(main.getByRole("link")).toHaveText([
    "Início",
    "Minha trilha",
    "Praticar",
    "Meu progresso",
  ]);
  await expect(
    main.getByRole("link", { name: "Início", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Laboratório", exact: true }),
  ).toBeHidden();
  await page.screenshot({
    path: ".tmp/phase5-dashboard-desktop.png",
    fullPage: true,
  });
});

test("advanced destinations and old deep links remain available and their group opens on direct access", async ({
  page,
}) => {
  await register(page.request, "Pessoa Explorando");
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", {
    name: "Área do aluno",
    exact: true,
  });
  await nav.locator("summary").filter({ hasText: "Explorar" }).click();
  const tools = nav.getByRole("group", { name: "Recursos adicionais" });
  const hrefs = await tools
    .locator("a")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")!));
  expect(hrefs).toEqual(
    expect.arrayContaining([
      "/laboratorio",
      "/playground",
      "/projetos",
      "/missoes",
      "/recompensas",
      "/habilidades",
      "/revisar",
      "/atividade",
      "/caderno",
      "/glossario",
      "/portfolio",
      "/relatorio",
      "/prova",
      "/linguagens",
    ]),
  );
  // Use the page's authenticated request context; keep ownership/session checks intact.
  for (const href of hrefs)
    expect((await page.request.get(href)).status(), href).toBeLessThan(400);
  for (const href of [
    "/laboratorio",
    "/playground",
    "/projetos",
    "/missoes",
    "/recompensas",
  ]) {
    await page.goto(href);
    await expect(page).toHaveURL(
      new URL(href, "http://127.0.0.1:3208").toString(),
    );
    await expect(nav.locator(`a[href='${href}']`)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      nav.getByRole("group", { name: "Recursos adicionais" }),
    ).toBeVisible();
    await expect(
      page.locator(".app-content").getByRole("heading").first(),
    ).toBeVisible();
  }
  await page.goto("/perfil");
  await expect(
    nav.getByRole("group", { name: "Conta e configurações" }),
  ).toBeVisible();
});

test("official continuation and XP survive logout, B stays empty, and A returns to its own lesson", async ({
  page,
}) => {
  const a = await register(page.request, "Marina Aprendendo");
  // An older account fixture unlocks later lessons; only the disposable test DB is touched.
  await sql(
    'UPDATE "User" SET "createdAt"=now()-interval \'2 days\' WHERE id=$1',
    [a.account.id],
  );
  const receipt = await submit(
    page.request,
    "primeiros-passos",
    'const nome = "Ada"; console.log("Olá, " + nome + "!");',
  );
  const xp = receipt.official.progress.xp;
  expect(xp).toBeGreaterThan(0);
  await submit(
    page.request,
    "tipos-de-dados",
    "// Minha tentativa ainda está incompleta",
  );
  await page.goto("/dashboard");
  const resume = page.getByRole("link", {
    name: "Continuar de onde parei",
    exact: true,
  });
  await expect(resume).toHaveAttribute("href", "/treino/tipos-de-dados");
  await expect(page.getByTestId("dashboard-xp")).toHaveText(`${xp} XP`);
  await expect(
    page.getByText("1 dia de prática registrado", { exact: true }),
  ).toBeVisible();
  await logout(page);
  await register(page.request, "Bruno Iniciante");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Olá, Bruno.",
  );
  await expect(page.getByTestId("dashboard-xp")).toHaveText("0 XP");
  await expect(
    page.getByRole("link", {
      name: "Começar minha primeira aula",
      exact: true,
    }),
  ).toHaveAttribute("href", "/treino/primeiros-passos");
  await expect(
    page.getByText("Nenhuma atividade registrada ainda."),
  ).toBeVisible();
  await expect(page.getByText("Marina", { exact: false })).toHaveCount(0);
  await logout(page);
  expect(
    (
      await page.request.post("/api/auth/login", {
        headers: authHeaders,
        data: { email: a.input.email, password },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Olá, Marina.",
  );
  await expect(resume).toHaveAttribute("href", "/treino/tipos-de-dados");
  await expect(page.getByTestId("dashboard-xp")).toHaveText(`${xp} XP`);
  await page.reload();
  await expect(resume).toHaveAttribute("href", "/treino/tipos-de-dados");
});

test("finishing all currently released lessons offers the path instead of a locked exercise", async ({
  page,
}) => {
  await register(page.request, "Paula Começando");
  await submit(
    page.request,
    "primeiros-passos",
    'const nome = "Ada"; console.log("Olá, " + nome + "!");',
  );
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", {
      name: "Você concluiu as aulas liberadas",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continuar de onde parei", exact: true }),
  ).toHaveAttribute("href", "/trilha");
});

test("mobile navigation opens, traps focus, closes on Escape or a link, and dashboard does not overflow", async ({
  page,
}) => {
  await register(page.request, "João Mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Olá, João.",
  );
  const opener = page.getByRole("button", { name: "Abrir menu", exact: true });
  const sidebar = page.getByRole("complementary", { name: "Menu do aluno" });
  await expect(sidebar).toBeHidden();
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar).toBeVisible();
  await sidebar
    .getByRole("link", { name: "LogicLab — início", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    sidebar.getByRole("button", { name: "Sair da conta", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(opener).toBeFocused();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const primary = page.getByRole("link", {
    name: "Começar minha primeira aula",
    exact: true,
  });
  await expect(sidebar).toBeHidden();
  expect((await primary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: ".tmp/phase5-dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await opener.click();
  await sidebar.locator("summary").filter({ hasText: "Explorar" }).click();
  await page.screenshot({
    path: ".tmp/phase5-menu-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await sidebar.getByRole("link", { name: "Laboratório", exact: true }).click();
  await expect(page).toHaveURL(/\/laboratorio$/);
  await expect(sidebar).toBeHidden();
  await opener.click();
  await expect(
    sidebar.getByRole("link", { name: "Laboratório", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("an unavailable official snapshot is not presented as a new empty account", async ({
  page,
}) => {
  await register(page.request, "Rita Reconectando");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", {
      name: "Começar minha primeira aula",
      exact: true,
    }),
  ).toBeVisible();
  // Reload with this account's local snapshot already present: its cached start
  // date must never masquerade as successful official progress loading.
  await page.route("**/api/attempts", (route) =>
    route.fulfill({ status: 503, json: { error: "Indisponível" } }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Seu progresso está indisponível agora",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("dashboard-xp")).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: "Começar minha primeira aula",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.unroute("**/api/attempts");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.getByTestId("dashboard-xp")).toHaveText("0 XP");
});
