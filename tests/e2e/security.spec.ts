import { finishDevelopmentVerification, testUsername } from "./auth-helpers";
import { expect, test } from "@playwright/test";

const mutationHeaders = {
  "content-type": "application/json",
  "x-logiclab-request": "same-origin",
};

test.describe("contas, segurança e suporte", () => {
  test("ciclo de conta protege recuperação, exportação e exclusão", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "O ciclo server-side completo é coberto uma vez.");
    const email = `seguranca-${Date.now()}@logiclab.dev`;
    const password = "SenhaSegura123";
    const newPassword = "OutraSenha456";
    test.setTimeout(90_000);

    await page.goto("/cadastro");
    await page
      .getByPlaceholder("Como podemos chamar você?")
      .fill("Conta Segura");
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
    await page.getByRole("button", { name: "Pular por agora" }).click();

    await page.goto("/seguranca");
    await expect(
      page.getByRole("heading", { name: "Seus dispositivos" }),
    ).toBeVisible();
    await expect(page.getByText("ESTE DISPOSITIVO")).toBeVisible();

    const exportedResponse = await page.request.post("/api/auth/account", {
      headers: mutationHeaders,
      data: { action: "export", password },
    });
    expect(exportedResponse.ok()).toBeTruthy();
    const exported = await exportedResponse.json();
    expect(exported.account.email).toBe(email);
    expect(JSON.stringify(exported)).not.toContain("passwordHash");
    expect(JSON.stringify(exported)).not.toContain("tokenHash");

    const existingRecovery = await page.request.post(
      "/api/auth/forgot-password",
      { headers: mutationHeaders, data: { email } },
    );
    const missingRecovery = await page.request.post(
      "/api/auth/forgot-password",
      {
        headers: mutationHeaders,
        data: { email: `ausente-${Date.now()}@logiclab.dev` },
      },
    );
    expect(existingRecovery.status()).toBe(202);
    expect(missingRecovery.status()).toBe(202);
    const existingPayload = await existingRecovery.json();
    const missingPayload = await missingRecovery.json();
    expect(existingPayload.message).toBe(missingPayload.message);
    expect(existingPayload.localResetUrl).toContain("token=");

    const token = new URL(
      existingPayload.localResetUrl,
      "http://logiclab.local",
    ).searchParams.get("token");
    expect(token).toBeTruthy();
    const reset = await page.request.post("/api/auth/reset-password", {
      headers: mutationHeaders,
      data: { token, password: newPassword, passwordConfirmation: newPassword },
    });
    expect(reset.ok()).toBeTruthy();
    const reuse = await page.request.post("/api/auth/reset-password", {
      headers: mutationHeaders,
      data: {
        token,
        password: "TerceiraSenha789",
        passwordConfirmation: "TerceiraSenha789",
      },
    });
    expect(reuse.status()).toBe(400);

    const invalidated = await page.request.get("/api/auth/me");
    expect((await invalidated.json()).account).toBeNull();
    const oldLogin = await page.request.post("/api/auth/login", {
      headers: mutationHeaders,
      data: { email, password },
    });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await page.request.post("/api/auth/login", {
      headers: mutationHeaders,
      data: { email, password: newPassword },
    });
    expect(newLogin.ok()).toBeTruthy();

    const wrongDelete = await page.request.delete("/api/auth/account", {
      headers: mutationHeaders,
      data: { confirmation: "EXCLUIR", password: newPassword },
    });
    expect(wrongDelete.status()).toBe(400);
    const deleted = await page.request.delete("/api/auth/account", {
      headers: mutationHeaders,
      data: {
        confirmation: "EXCLUIR MINHA CONTA",
        password: newPassword,
      },
    });
    expect(deleted.ok()).toBeTruthy();
    const deletedLogin = await page.request.post("/api/auth/login", {
      headers: mutationHeaders,
      data: { email, password: newPassword },
    });
    expect(deletedLogin.status()).toBe(401);
  });

  test("demo pública executa com limites e a ajuda abre um ticket", async ({
    page,
  }) => {
    await page.goto("/");
    const editor = page.getByLabel("Editor da demonstração pública");
    await page.getByRole("button", { name: "Executar", exact: true }).click();
    await expect(page.locator(".public-demo-terminal pre")).toContainText(
      "Olá Mundo",
    );
    await expect(page.getByText("Funcionou!", { exact: true })).toBeVisible();

    await editor.fill("for (let i = 0; i < 600; i += 1) console.log(i);");
    await page.getByRole("button", { name: "Executar", exact: true }).click();
    await expect(page.locator(".public-demo-terminal pre")).toContainText(
      "Saída muito grande",
    );

    await page.goto("/ajuda");
    await page
      .getByLabel("Buscar na central de ajuda")
      .fill("falha de pagamento");
    await page
      .getByRole("button", {
        name: /Uma falha de pagamento apaga meu progresso/,
      })
      .click();
    await expect(page.getByText(/tentativas, projetos/)).toBeVisible();
    await page
      .getByLabel("O que aconteceu?")
      .fill("O terminal não exibiu o resultado esperado durante meu teste.");
    await page.getByRole("button", { name: "Enviar report" }).click();
    await expect(page.getByText(/Ticket .* aberto/)).toBeVisible();
  });
});
