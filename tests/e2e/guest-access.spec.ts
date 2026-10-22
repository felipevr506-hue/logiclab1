import { expect, test } from "@playwright/test";

test("guest can enter without a database and cannot access private accounts", async ({ page }) => {
  const progressRequests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/progress")
      progressRequests.push(request.url());
  });
  await page.goto("/entrar");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Entrar como convidado" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Olá, Convidado." })).toBeVisible();
  const identity = await (await page.request.get("/api/auth/me")).json();
  expect(identity.demo).toBe(true);
  expect(identity.account).toMatchObject({ guest: true, role: "STUDENT", plan: "FREE" });
  expect(identity.account.id).toMatch(/^guest:/);
  const owner = identity.account.id as string;
  await expect.poll(() => page.evaluate(id => {
    const raw = localStorage.getItem(`logiclab-state-v2:${encodeURIComponent(id)}`);
    return raw ? JSON.parse(raw).user.accountId : null;
  }, owner)).toBe(owner);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Olá, Convidado." })).toBeVisible();
  expect(progressRequests).toEqual([]);
  const reloaded = await (await page.request.get("/api/auth/me")).json();
  expect(reloaded.account.id).toBe(owner);
  expect((await page.request.get("/api/progress?account=guest@logiclab.invalid")).status()).toBe(403);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Olá, Convidado." })).toBeVisible();
  const openMenu = page.getByRole("button", { name: "Abrir menu" });
  if (await openMenu.isVisible()) await openMenu.click();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  const signedOut = await (await page.request.get("/api/auth/me")).json();
  expect(signedOut.account).toBeNull();
});
