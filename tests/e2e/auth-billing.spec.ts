import { verifyDevelopmentSignup, testUsername } from "./auth-helpers";
import { expect, test } from "@playwright/test";

const mutationHeaders = {
  "content-type": "application/json",
  "x-logiclab-request": "same-origin",
};

test("auth and checkout contracts reject forgery without granting Premium", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The server contract only needs one browser profile.");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `billing-${suffix}@logiclab.dev`;
  const password = "SenhaSegura123";

  const invalidEmail = await page.request.post("/api/auth/signup", {
    headers: mutationHeaders,
    data: {
      name: "Conta inválida",
      email: "email-invalido",
      password,
      acceptedTerms: true,
    },
  });
  expect(invalidEmail.status()).toBe(400);

  const weakPassword = await page.request.post("/api/auth/signup", {
    headers: mutationHeaders,
    data: {
      name: "Conta inválida",
      email: `weak-${email}`,
      password: "semnumero",
      acceptedTerms: true,
    },
  });
  expect(weakPassword.status()).toBe(400);

  const signup = await page.request.post("/api/auth/signup", {
    headers: mutationHeaders,
    data: {
      name: "Conta Billing",
      email,
      username: testUsername(email),
      password,
      passwordConfirmation: password,
      acceptedTerms: true,
    },
  });
  expect(signup.status()).toBe(201);
  await verifyDevelopmentSignup(page.request, await signup.json());

  const invalidPlan = await page.request.post("/api/billing/checkout", {
    headers: { ...mutationHeaders, "idempotency-key": `invalid-${suffix}` },
    data: { planId: "invented-premium", price: 1, approved: true },
  });
  expect(invalidPlan.status()).toBe(400);

  const forgedPrice = await page.request.post("/api/billing/checkout", {
    headers: { ...mutationHeaders, "idempotency-key": `checkout-${suffix}` },
    data: { planId: "premium-monthly", price: 1, approved: true },
  });
  expect(forgedPrice.status()).toBe(503);

  const account = await page.request.get("/api/auth/me");
  expect((await account.json()).account.plan).toBe("FREE");

  const forgedWebhook = await page.request.post("/api/webhooks/billing", {
    headers: {
      "content-type": "application/json",
      "x-hotmart-hottok": "forged-hottok",
    },
    data: { id: "forged-event", event: "PURCHASE_APPROVED", version: "2.0.0" },
  });
  expect(forgedWebhook.status()).toBe(401);

  const wrongLogin = await page.request.post("/api/auth/login", {
    headers: mutationHeaders,
    data: { email, password: "SenhaErrada123" },
  });
  expect(wrongLogin.status()).toBe(401);

  const logout = await page.request.post("/api/auth/logout", {
    headers: mutationHeaders,
  });
  expect(logout.ok()).toBeTruthy();
  const loggedOut = await page.request.get("/api/auth/me");
  expect((await loggedOut.json()).account).toBeNull();

  const login = await page.request.post("/api/auth/login", {
    headers: mutationHeaders,
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  expect((await login.json()).account.plan).toBe("FREE");
});

test("auth and plan pages do not overflow at 360, 390 or 430 pixels", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "This test explicitly exercises all required widths.");
  test.setTimeout(180_000);
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of [
      "/entrar",
      "/cadastro",
      "/recuperar-senha",
      "/planos",
      "/checkout/cancelado",
    ]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(horizontalOverflow, `${path} overflowed at ${width}px`).toBe(
        false,
      );
    }
  }
});
