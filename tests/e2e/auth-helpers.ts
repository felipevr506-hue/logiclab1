import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const authHeaders = {
  "content-type": "application/json",
  "x-logiclab-request": "same-origin",
};
export function testUsername(email: string) {
  return `u_${email
    .split("@")[0]
    .replace(/[^a-z0-9_]/gi, "_")
    .slice(-30)}`;
}
export async function verifyDevelopmentSignup(
  request: APIRequestContext,
  payload: { delivery: { localUrl: string } },
) {
  const token = new URL(
    payload.delivery.localUrl,
    "http://localhost",
  ).searchParams.get("token");
  const response = await request.post("/api/auth/verify-email", {
    headers: authHeaders,
    data: { token },
  });
  expect(await response.json()).toMatchObject({ status: "verified" });
}
export async function finishDevelopmentVerification(page: Page) {
  await expect(page).toHaveURL(/\/confirmar-email$/);
  await page
    .getByRole("link", { name: "Abrir confirmação local de desenvolvimento" })
    .click();
  await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
  await expect(page.getByRole("status")).toContainText("E-mail confirmado");
  await page.goto("/onboarding");
}
