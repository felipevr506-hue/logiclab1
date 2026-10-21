import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { authHeaders, verifyDevelopmentSignup } from "./auth-helpers";

const password = "LandingSecurePassword123";
async function register(
  request: APIRequestContext,
  verified = false,
  onboarded = false,
) {
  const suffix = randomBytes(6).toString("hex");
  const input = {
    name: "Pessoa Aprendendo",
    username: `entry_${suffix}`,
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
  if (verified) await verifyDevelopmentSignup(request, payload);
  if (onboarded) {
    const profile = await request.post("/api/profile/onboarding", {
      headers: authHeaders,
      data: {
        experience: "Nunca",
        goal: "Aprender programação",
        dailyMinutes: 20,
        locale: "pt-BR",
        initialLanguage: "javascript",
      },
    });
    expect(profile.status()).toBe(200);
  }
  return { input, payload };
}

test("visitor gets a compact landing with direct signup and login links", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Aprenda programação.Coloque suas ideias em código.",
  );
  await expect(page.locator("main section")).toHaveCount(6);
  await expect(page.locator("main figure")).toHaveCount(1);
  await expect(page.locator("main details")).toHaveCount(3);
  await expect(
    page.locator("main textarea, main iframe, .matrix-rain"),
  ).toHaveCount(0);
  expect(await (await request.get("/api/auth/me")).json()).toMatchObject({
    account: null,
    demo: false,
  });
  const starts = page.getByRole("link", {
    name: "Começar grátis",
    exact: true,
  });
  await expect(starts).toHaveCount(2);
  for (const link of await starts.all())
    await expect(link).toHaveAttribute("href", "/cadastro");
  await starts.first().click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await page.goto("/");
  await page
    .getByRole("link", { name: "Já tenho uma conta", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/");
  const hrefs = await page
    .locator("a[href^='/']")
    .evaluateAll((nodes) => [
      ...new Set(nodes.map((node) => node.getAttribute("href")!)),
    ]);
  for (const href of hrefs)
    expect((await request.get(href)).status(), href).toBeLessThan(400);
});

test("mobile landing has usable CTAs, keyboard access, FAQ and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // Wait for the account provider. Next's dev-tools portal owns the initial Tab.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Pular para o conteúdo" }).focus();
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const start = page
    .getByRole("link", { name: "Começar grátis", exact: true })
    .first();
  await expect(start).toBeInViewport();
  expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("details").first().locator("summary").click();
  await expect(page.locator("details").first()).toHaveAttribute("open", "");
  await expect(page.locator("details").first()).toContainText(
    "começar do zero",
  );
  await page.screenshot({ path: ".tmp/phase4-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: ".tmp/phase4-desktop.png", fullPage: true });
});

test("authenticated landing continues to verification, then onboarding, then the app without signup", async ({
  page,
}) => {
  const { payload } = await register(page.request);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Começar grátis", exact: true }),
  ).toHaveCount(0);
  const resume = page.getByRole("link", {
    name: "Continuar aprendendo",
    exact: true,
  });
  await expect(resume.first()).toHaveAttribute("href", "/confirmar-email");
  await resume.first().click();
  await expect(page).toHaveURL(/\/confirmar-email$/);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/confirmar-email$/);
  await verifyDevelopmentSignup(page.request, payload);
  await page.goto("/");
  await expect(resume.first()).toHaveAttribute("href", "/onboarding");
  await resume.first().click();
  await expect(page).toHaveURL(/\/onboarding$/);
  const saved = await page.request.post("/api/profile/onboarding", {
    headers: authHeaders,
    data: {
      experience: "Nunca",
      goal: "Aprender programação",
      dailyMinutes: 20,
      locale: "pt-BR",
      initialLanguage: "javascript",
    },
  });
  expect(saved.status()).toBe(200);
  await page.goto("/");
  await expect(resume.first()).toHaveAttribute("href", "/dashboard");
  await resume.first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("existing account login preserves a legitimate next and refuses external or recursive destinations", async ({
  page,
}) => {
  const { input } = await register(page.request, true, true);
  for (const [next, destination] of [
    ["/dashboard?origem=landing", "/dashboard?origem=landing"],
    ["https://example.test/steal", "/dashboard"],
    ["//example.test/steal", "/dashboard"],
    ["/\\example.test/steal", "/dashboard"],
    ["/entrar?next=/cadastro", "/dashboard"],
  ]) {
    await page.request.post("/api/auth/logout", { headers: authHeaders });
    await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
    await page.getByLabel("E-mail", { exact: true }).fill(input.email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "ENTRAR", exact: true }).click();
    await expect(page).toHaveURL(
      new URL(destination, "http://127.0.0.1:3208").toString(),
    );
  }
});
