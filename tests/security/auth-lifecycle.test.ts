import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeEmail,
  normalizeUsername,
  validateUsername,
} from "../../lib/auth-validation";
import { verificationStatus } from "../../services/auth/verification-policy";
import {
  publicEmailDelivery,
  sendAuthEmail,
} from "../../services/email/auth-email";

test("usernames normalize case and enforce the reserved namespace and format", () => {
  assert.equal(normalizeUsername("  Alice_12 "), "alice_12");
  assert.equal(normalizeEmail("  Alice@Example.TEST "), "alice@example.test");
  for (const username of ["alice", "A_1", "a".repeat(32)])
    assert.equal(validateUsername(username), null);
  for (const username of [
    "ab",
    "a".repeat(33),
    "1alice",
    "álice",
    "alice smith",
    "alice.x",
    "legacy_1",
  ])
    assert.ok(validateUsername(username));
});

test("verification distinguishes valid, expired, used and already verified tokens", () => {
  const valid = { usedAt: null, expiresAt: new Date(Date.now() + 60_000) };
  assert.equal(verificationStatus(valid, false), "verified");
  assert.equal(verificationStatus(valid, true), "already_verified");
  assert.equal(
    verificationStatus({ ...valid, usedAt: new Date() }, true),
    "used",
  );
  assert.equal(
    verificationStatus({ ...valid, expiresAt: new Date(0) }, false),
    "expired",
  );
});

async function emailEnvironment(
  env: Record<string, string | undefined>,
  run: () => Promise<void>,
) {
  const keys = [
    "APP_ENV",
    "NODE_ENV",
    "AUTH_EMAIL_DELIVERY",
    "RESEND_API_KEY",
    "AUTH_EMAIL_FROM",
    "NEXT_PUBLIC_APP_URL",
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    for (const key of keys) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    await run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

const input = {
  to: "user@example.test",
  kind: "verify" as const,
  token: "test-token",
};
test("missing email provider offers a marked local link only in development on loopback", async () => {
  await emailEnvironment(
    { APP_ENV: "development", NODE_ENV: "development" },
    async () => {
      const delivery = await sendAuthEmail(input);
      assert.equal(delivery.status, "development");
      assert.equal(delivery.delivered, false);
      assert.ok(publicEmailDelivery(delivery, "localhost").localUrl);
      assert.equal(
        publicEmailDelivery(delivery, "example.com").localUrl,
        undefined,
      );
    },
  );
});

test("production never exposes local links or pretends missing delivery succeeded", async () => {
  await emailEnvironment(
    {
      APP_ENV: "production",
      NODE_ENV: "production",
      AUTH_EMAIL_DELIVERY: "console",
    },
    async () => {
      const delivery = await sendAuthEmail(input);
      assert.equal(delivery.status, "failed");
      assert.equal(delivery.delivered, false);
      assert.equal(delivery.localUrl, undefined);
    },
  );
});

test("an unconfigured local Resend mode offers a link, but production boundaries never do", async () => {
  for (const mode of [undefined, "resend", "console", "development"]) {
    await emailEnvironment(
      { NODE_ENV: "development", AUTH_EMAIL_DELIVERY: mode },
      async () => {
        const delivery = await sendAuthEmail(input);
        assert.equal(delivery.status, "development");
        assert.ok(publicEmailDelivery(delivery, "127.0.0.1").localUrl);
      },
    );
  }
  for (const env of [
    { NODE_ENV: "production", APP_ENV: "development" },
    { NODE_ENV: "development", APP_ENV: "production" },
    { NODE_ENV: "development", APP_ENV: "staging" },
  ]) {
    await emailEnvironment(env, async () => {
      assert.equal((await sendAuthEmail(input)).status, "failed");
      const exposed = publicEmailDelivery(
        {
          status: "development",
          delivered: false,
          local: true,
          localUrl: "/verificar-email?token=internal-token",
        },
        "localhost",
      );
      assert.equal(exposed.local, false);
      assert.equal("localUrl" in JSON.parse(JSON.stringify(exposed)), false);
    });
  }
});

test("configured Resend in development always sends and never falls back on provider errors", async () => {
  for (const mode of [undefined, "resend", "console", "development"]) {
    await emailEnvironment(
      {
        NODE_ENV: "development",
        AUTH_EMAIL_DELIVERY: mode,
        RESEND_API_KEY: "unit-test-only-not-a-credential",
        AUTH_EMAIL_FROM: "LogicLab <auth@example.test>",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      },
      async () => {
        const original = globalThis.fetch;
        let calls = 0;
        try {
          globalThis.fetch = async (url, options) => {
            calls++;
            assert.equal(url, "https://api.resend.com/emails");
            const body = JSON.parse(String(options?.body));
            assert.ok(
              body.text.includes(
                "http://localhost:3000/verificar-email?token=",
              ),
            );
            return Response.json({ id: "unit-test-receipt" });
          };
          const sent = await sendAuthEmail(input);
          assert.equal(calls, 1);
          assert.deepEqual(sent, {
            status: "sent",
            delivered: true,
            local: false,
          });
          globalThis.fetch = async () => Response.json({}, { status: 503 });
          const failed = await sendAuthEmail(input);
          assert.equal(failed.status, "failed");
          assert.equal(failed.localUrl, undefined);
        } finally {
          globalThis.fetch = original;
        }
      },
    );
  }
});

test("Resend failures and missing receipts fail closed; an accepted receipt succeeds", async () => {
  await emailEnvironment(
    {
      APP_ENV: "production",
      NODE_ENV: "production",
      AUTH_EMAIL_DELIVERY: "resend",
      RESEND_API_KEY: "test-key",
      AUTH_EMAIL_FROM: "LogicLab <auth@example.test>",
      NEXT_PUBLIC_APP_URL: "https://app.example.test",
    },
    async () => {
      const original = globalThis.fetch;
      try {
        globalThis.fetch = async () =>
          Response.json({ error: "rejected" }, { status: 503 });
        assert.equal((await sendAuthEmail(input)).status, "failed");
        globalThis.fetch = async () => Response.json({});
        assert.equal((await sendAuthEmail(input)).delivered, false);
        globalThis.fetch = async (_url, options) => {
          assert.match(String(options?.body), /verificar-email/);
          return Response.json({ id: "provider-message-id" });
        };
        assert.equal((await sendAuthEmail(input)).status, "sent");
      } finally {
        globalThis.fetch = original;
      }
    },
  );
});
