import { expect, test, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { authHeaders, verifyDevelopmentSignup } from "./auth-helpers";

const password = "SecurePhase2Pass123";
const failureMode = Boolean(process.env.PHASE2_EMAIL_FAILURE);
function fields() {
  const suffix = randomBytes(6).toString("hex");
  return {
    name: "Conta Real",
    username: `user_${suffix}`,
    email: `${suffix}@example.test`,
    password,
    passwordConfirmation: password,
    acceptedTerms: true,
  };
}
async function sql(query: string, values: unknown[] = []) {
  const url = process.env.PHASE2_DATABASE_URL;
  if (
    !url ||
    !/^\/logiclab_phase2_test_[a-f0-9]{12}$/.test(new URL(url).pathname)
  )
    throw new Error("Refusing non-test database.");
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    // Prisma uses UTC for timestamp-without-time-zone fields.
    await db.query("SET TIME ZONE 'UTC'");
    return await db.query(query, values);
  } finally {
    await db.end();
  }
}
async function register(request: APIRequestContext, verified = false) {
  const input = fields();
  const response = await request.post("/api/auth/signup", {
    headers: authHeaders,
    data: input,
  });
  expect(response.status()).toBe(201);
  const payload = await response.json();
  if (verified) await verifyDevelopmentSignup(request, payload);
  return {
    input,
    payload,
    token: new URL(
      payload.delivery.localUrl,
      "http://localhost",
    ).searchParams.get("token")!,
  };
}
async function verify(request: APIRequestContext, token: string) {
  return request.post("/api/auth/verify-email", {
    headers: authHeaders,
    data: { token },
  });
}

test.describe("real account lifecycle", () => {
  test.skip(failureMode, "Provider failure runs separately.");

  test("migration preserves existing IDs and progress and enforces database constraints", async () => {
    const result = await sql(
      'SELECT u.id,u.username,u.email,p.payload FROM "User" u JOIN "ProgressBackup" p ON p."userId"=u.id WHERE u.id=$1',
      ["phase2-legacy"],
    );
    expect(result.rows[0]).toMatchObject({
      id: "phase2-legacy",
      username: "legacy_1",
      email: "legacy@example.test",
      payload: { preserved: true },
    });
    await expect(
      sql('UPDATE "User" SET username=$1 WHERE id=$2', [
        "UpperCase",
        "phase2-legacy",
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql('UPDATE "User" SET email=$1 WHERE id=$2', [
        "Legacy@EXAMPLE.test",
        "phase2-legacy",
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });

  test("valid signup normalizes identifiers and rejects duplicate username, case variants, email, confirmation and terms", async ({
    request,
  }) => {
    const input = fields();
    const good = await request.post("/api/auth/signup", {
      headers: authHeaders,
      data: {
        ...input,
        username: input.username.toUpperCase(),
        email: ` ${input.email.toUpperCase()} `,
      },
    });
    expect(good.status()).toBe(201);
    const payload = await good.json();
    expect(payload).toMatchObject({
      verificationRequired: true,
      account: {
        username: input.username,
        email: input.email,
        name: input.name,
        emailVerifiedAt: null,
      },
      delivery: { status: "development", delivered: false },
    });
    const variants = [
      { ...fields(), username: input.username },
      { ...fields(), username: input.username.toUpperCase() },
      { ...fields(), email: input.email.toUpperCase() },
    ];
    for (const data of variants)
      expect(
        (
          await request.post("/api/auth/signup", { headers: authHeaders, data })
        ).status(),
      ).toBe(409);
    for (const data of [
      { ...fields(), passwordConfirmation: "DifferentPass123" },
      { ...fields(), username: "1invalid" },
      { ...fields(), acceptedTerms: false },
      { ...fields(), username: "ab" },
    ])
      expect(
        (
          await request.post("/api/auth/signup", { headers: authHeaders, data })
        ).status(),
      ).toBe(400);
  });

  test("login authenticates credentials but unverified accounts cannot open protected pages or APIs", async ({
    page,
  }) => {
    const { input, payload, token } = await register(page.request);
    expect(
      (
        await page.request.post("/api/auth/login", {
          headers: authHeaders,
          data: { email: input.email, password: "WrongPassword123" },
        })
      ).status(),
    ).toBe(401);
    const login = await page.request.post("/api/auth/login", {
      headers: authHeaders,
      data: { email: input.email.toUpperCase(), password },
    });
    expect(login.status()).toBe(200);
    expect(await login.json()).toMatchObject({ verificationRequired: true });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/confirmar-email$/);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/confirmar-email$/);
    expect(
      (
        await page.request.get(
          `/api/progress?account=${input.email}&ownerId=${payload.account.id}`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post("/api/tutor/usage", {
          headers: authHeaders,
          data: {},
        })
      ).status(),
    ).toBe(401);
    expect((await verify(page.request, token)).status()).toBe(200);
    expect(await (await verify(page.request, token)).json()).toMatchObject({
      status: "used",
    });
    expect(
      await (
        await verify(page.request, randomBytes(32).toString("base64url"))
      ).json(),
    ).toMatchObject({ status: "invalid" });
    expect(
      await (
        await page.request.post("/api/auth/resend-verification", {
          headers: authHeaders,
        })
      ).json(),
    ).toMatchObject({ status: "already_verified" });
    // A valid unused token for an already verified account is idempotent.
    const extra = randomBytes(32).toString("base64url");
    await sql(
      'INSERT INTO "EmailVerificationToken" (id,"userId","tokenHash","expiresAt") VALUES ($1,$2,$3,$4)',
      [
        randomUUID(),
        payload.account.id,
        createHash("sha256").update(extra).digest("hex"),
        new Date(Date.now() + 3600_000).toISOString(),
      ],
    );
    expect(await (await verify(page.request, extra)).json()).toMatchObject({
      status: "already_verified",
    });
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("expired verification and resend enforce cooldown, invalidate old links and limit hourly sends", async ({
    request,
  }) => {
    const { payload, token } = await register(request);
    const initial = await request.post("/api/auth/resend-verification", {
      headers: authHeaders,
    });
    expect(initial.status()).toBe(429);
    expect(Number(initial.headers()["retry-after"])).toBeGreaterThan(0);
    await sql(
      'UPDATE "EmailVerificationToken" SET "expiresAt"=now()-interval \'1 second\',"createdAt"=now()-interval \'61 seconds\' WHERE "userId"=$1',
      [payload.account.id],
    );
    expect(await (await verify(request, token)).json()).toMatchObject({
      status: "expired",
    });
    const resend = await request.post("/api/auth/resend-verification", {
      headers: authHeaders,
    });
    expect(resend.status()).toBe(200);
    const delivery = (await resend.json()).delivery;
    expect(delivery.status).toBe("development");
    const newToken = new URL(
      delivery.localUrl,
      "http://localhost",
    ).searchParams.get("token")!;
    expect(newToken).not.toBe(token);
    expect(
      (
        await request.post("/api/auth/resend-verification", {
          headers: authHeaders,
        })
      ).status(),
    ).toBe(429);
    await sql(
      'UPDATE "EmailVerificationToken" SET "createdAt"=now()-interval \'61 seconds\' WHERE "userId"=$1',
      [payload.account.id],
    );
    for (let index = 0; index < 4; index++)
      await sql(
        'INSERT INTO "EmailVerificationToken" (id,"userId","tokenHash","createdAt","expiresAt") VALUES ($1,$2,$3,now()-interval \'90 seconds\',now()-interval \'1 second\')',
        [randomUUID(), payload.account.id, randomBytes(32).toString("hex")],
      );
    const limited = await request.post("/api/auth/resend-verification", {
      headers: authHeaders,
    });
    expect(limited.status()).toBe(429);
    expect(limited.headers()["retry-after"]).toBe("3600");
    expect(await (await verify(request, newToken)).json()).toMatchObject({
      status: "verified",
    });
  });

  test("password recovery revokes old sessions and resetting A never clears the valid session of B", async ({
    page,
    browser,
  }) => {
    const { input } = await register(page.request, true);
    const otherA = await browser.newContext();
    const accountB = await browser.newContext();
    try {
      expect(
        (
          await otherA.request.post("/api/auth/login", {
            headers: authHeaders,
            data: { email: input.email, password },
          })
        ).status(),
      ).toBe(200);
      const b = await register(accountB.request, true);
      const recovery = await page.request.post("/api/auth/forgot-password", {
        headers: authHeaders,
        data: { email: input.email },
      });
      const missing = await page.request.post("/api/auth/forgot-password", {
        headers: authHeaders,
        data: { email: "missing@example.test" },
      });
      const result = await recovery.json();
      expect(result.message).toBe((await missing.json()).message);
      expect(result.developmentOnly).toBe(true);
      const token = new URL(
        result.localResetUrl,
        "http://localhost",
      ).searchParams.get("token");
      const next = "NewSecurePassword456";
      expect(
        (
          await page.request.post("/api/auth/reset-password", {
            headers: authHeaders,
            data: { token, password: next, passwordConfirmation: "different" },
          })
        ).status(),
      ).toBe(400);
      expect(
        (
          await accountB.request.post("/api/auth/reset-password", {
            headers: authHeaders,
            data: { token, password: next, passwordConfirmation: next },
          })
        ).status(),
      ).toBe(200);
      expect(
        (await (await accountB.request.get("/api/auth/me")).json()).account.id,
      ).toBe(b.payload.account.id);
      expect(
        (await (await otherA.request.get("/api/auth/me")).json()).account,
      ).toBeNull();
      expect(
        (await (await page.request.get("/api/auth/me")).json()).account,
      ).toBeNull();
      expect(
        (
          await page.request.post("/api/auth/login", {
            headers: authHeaders,
            data: { email: input.email, password },
          })
        ).status(),
      ).toBe(401);
      expect(
        (
          await page.request.post("/api/auth/login", {
            headers: authHeaders,
            data: { email: input.email, password: next },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await page.request.post("/api/auth/reset-password", {
            headers: authHeaders,
            data: { token, password: next, passwordConfirmation: next },
          })
        ).status(),
      ).toBe(400);
    } finally {
      await otherA.close();
      await accountB.close();
    }
  });

  test("email-change requires fresh verification and cannot bypass resend limits", async ({
    request,
  }) => {
    const { payload, token } = await register(request);
    const nextEmail = fields().email;
    const changed = await request.patch("/api/auth/account", {
      headers: authHeaders,
      data: { action: "email", email: nextEmail, currentPassword: password },
    });
    expect(changed.status()).toBe(200);
    expect(await changed.json()).toMatchObject({
      verificationRequired: true,
      delivery: { status: "failed", delivered: false },
    });
    expect(
      (await (await request.get("/api/auth/me")).json()).account,
    ).toMatchObject({
      id: payload.account.id,
      email: nextEmail,
      emailVerifiedAt: null,
    });
    expect(await (await verify(request, token)).json()).toMatchObject({
      status: "expired",
    });
    expect(
      (
        await request.post("/api/auth/resend-verification", {
          headers: authHeaders,
        })
      ).status(),
    ).toBe(429);
    await sql(
      'UPDATE "EmailVerificationToken" SET "createdAt"=now()-interval \'61 seconds\' WHERE "userId"=$1',
      [payload.account.id],
    );
    const resent = await request.post("/api/auth/resend-verification", {
      headers: authHeaders,
    });
    expect(resent.status()).toBe(200);
    const replacement = new URL(
      (await resent.json()).delivery.localUrl,
      "http://localhost",
    ).searchParams.get("token")!;
    expect(await (await verify(request, replacement)).json()).toMatchObject({
      status: "verified",
    });
  });

  test("signup UI requires username and routes through the explicit development confirmation screen", async ({
    page,
  }) => {
    const input = fields();
    await page.goto("/cadastro");
    await page.getByLabel("Nome", { exact: true }).fill(input.name);
    await page.getByLabel("Username", { exact: true }).fill(input.username);
    await page.getByLabel("E-mail", { exact: true }).fill(input.email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page
      .getByLabel("Confirmar senha", { exact: true })
      .fill("WrongConfirmation123");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /criar conta/i }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "As senhas não coincidem",
    );
    await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: /criar conta/i }).click();
    await expect(page).toHaveURL(/\/confirmar-email$/);
    await expect(
      page.getByText("Somente desenvolvimento: nenhum e-mail foi enviado.", {
        exact: false,
      }),
    ).toBeVisible();
    const localLink = page.getByRole("link", {
      name: "Abrir confirmação local de desenvolvimento",
    });
    const originalLink = await localLink.getAttribute("href");
    await page.reload();
    await expect(localLink).toHaveAttribute("href", originalLink!);
    const account = (await (await page.request.get("/api/auth/me")).json())
      .account;
    expect(account.emailVerifiedAt).toBeNull();
    await sql(
      'UPDATE "EmailVerificationToken" SET "createdAt"=now()-interval \'61 seconds\' WHERE "userId"=$1',
      [account.id],
    );
    await page
      .getByRole("button", { name: "Reenviar confirmação", exact: true })
      .click();
    await expect(localLink).not.toHaveAttribute("href", originalLink!);
    const replacementLink = await localLink.getAttribute("href");
    await page.reload();
    await expect(localLink).toHaveAttribute("href", replacementLink!);
    await page
      .getByRole("link", { name: "Abrir confirmação local de desenvolvimento" })
      .click();
    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
    await expect(page.getByRole("status")).toContainText("E-mail confirmado");
    await page
      .getByRole("link", { name: "Continuar para o aplicativo" })
      .click();
    await expect(page).toHaveURL(/\/onboarding$/);
    const confirmed = (await (await page.request.get("/api/auth/me")).json())
      .account;
    expect(confirmed.id).toBe(account.id);
    expect(confirmed.emailVerifiedAt).toBeTruthy();
    expect(
      (
        await page.request.post("/api/auth/login", {
          headers: authHeaders,
          data: { email: input.email, password },
        })
      ).status(),
    ).toBe(200);
  });

  test("recovery UI labels development links and successfully resets the password", async ({
    page,
  }) => {
    const { input } = await register(page.request, true);
    await page.goto("/recuperar-senha");
    await page.getByLabel("Seu e-mail").fill(input.email);
    await page
      .getByRole("button", { name: /enviar link de recuperação/i })
      .click();
    await expect(
      page.getByText("Somente desenvolvimento: nenhum e-mail foi enviado."),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Abrir link local de desenvolvimento" })
      .click();
    await page
      .getByLabel("Nova senha", { exact: true })
      .fill("UiPasswordUpdated789");
    await page
      .getByLabel("Confirmar nova senha", { exact: true })
      .fill("UiPasswordUpdated789");
    await page.getByRole("button", { name: /salvar nova senha/i }).click();
    await expect(
      page.getByText("Senha alterada. As sessões anteriores foram encerradas."),
    ).toBeVisible();
    expect(
      (
        await page.request.post("/api/auth/login", {
          headers: authHeaders,
          data: { email: input.email, password: "UiPasswordUpdated789" },
        })
      ).status(),
    ).toBe(200);
  });
});

test("provider delivery failure remains pending, exposes no local token, and resend returns 503", async ({
  page,
}) => {
  test.skip(!failureMode, "Runs separately with Resend unavailable.");
  const signup = await page.request.post("/api/auth/signup", {
    headers: authHeaders,
    data: fields(),
  });
  expect(signup.status()).toBe(201);
  const payload = await signup.json();
  expect(payload.delivery).toMatchObject({
    status: "failed",
    delivered: false,
    local: false,
  });
  expect(payload.delivery.localUrl).toBeUndefined();
  const input = fields();
  await page.goto("/cadastro");
  await page.getByLabel("Nome", { exact: true }).fill(input.name);
  await page.getByLabel("Username", { exact: true }).fill(input.username);
  await page.getByLabel("E-mail", { exact: true }).fill(input.email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /criar conta/i }).click();
  await expect(page).toHaveURL(/\/confirmar-email$/);
  await expect(
    page.getByText("Sua conta está salva, mas não foi possível enviar", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/confirmar-email$/);
  const account = (await (await page.request.get("/api/auth/me")).json())
    .account;
  expect(account.emailVerifiedAt).toBeNull();
  expect(account.id).not.toBe(payload.account.id);
  await sql(
    'UPDATE "EmailVerificationToken" SET "createdAt"=now()-interval \'61 seconds\' WHERE "userId"=$1',
    [account.id],
  );
  const resend = await page.request.post("/api/auth/resend-verification", {
    headers: authHeaders,
  });
  expect(resend.status()).toBe(503);
  expect((await resend.json()).delivery.delivered).toBe(false);
});
