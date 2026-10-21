import { NextRequest, NextResponse } from "next/server";
import {
  isFeatureFlagKey,
  readFeatureFlags,
  setFeatureFlag,
} from "@/services/admin/feature-store";
import { recordAdminAudit } from "@/services/admin/audit-store";
import { requireRole } from "@/services/auth/auth-store";
import {
  consumeRateLimit,
  getClientAddress,
  isTrustedMutation,
} from "@/services/security/request-guard";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ flags: await readFeatureFlags() });
}

export async function PUT(request: NextRequest) {
  const rate = consumeRateLimit(
    `features:${getClientAddress(request)}`,
    30,
    60_000,
  );
  if (!rate.allowed)
    return NextResponse.json({ error: "Limite excedido." }, { status: 429 });
  if (!isTrustedMutation(request))
    return NextResponse.json(
      { error: "Solicitação recusada." },
      { status: 403 },
    );
  const administrator = await requireRole(request, "ADMIN");
  if (!administrator)
    return NextResponse.json(
      { error: "Acesso administrativo necessário." },
      { status: 403 },
    );
  let body: { key?: string; enabled?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (
    !body.key ||
    !isFeatureFlagKey(body.key) ||
    typeof body.enabled !== "boolean"
  )
    return NextResponse.json(
      { error: "Feature flag inválida." },
      { status: 400 },
    );
  const before = await readFeatureFlags();
  const flags = await setFeatureFlag(body.key, body.enabled);
  await recordAdminAudit({
    actorId: administrator.account.id,
    action: "feature-flag.update",
    target: body.key,
    before: before[body.key],
    after: body.enabled,
    ip: getClientAddress(request),
  });
  return NextResponse.json({ flags });
}
