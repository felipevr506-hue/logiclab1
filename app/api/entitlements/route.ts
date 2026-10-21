import { NextRequest, NextResponse } from "next/server";
import { getRequestSession } from "@/services/auth/auth-store";
import {
  ENTITLEMENT_KEYS,
  type EntitlementKey,
} from "@/services/entitlements/entitlements";
import {
  getUserEntitlements,
  userHasEntitlement,
} from "@/services/entitlements/server-access";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authenticated = await getRequestSession(request);
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const requested = request.nextUrl.searchParams.get("feature");
  if (requested) {
    if (!ENTITLEMENT_KEYS.includes(requested as EntitlementKey))
      return NextResponse.json({ error: "Recurso inválido." }, { status: 400 });
    const allowed = await userHasEntitlement(
      authenticated.account.id,
      requested as EntitlementKey,
    );
    if (!allowed)
      return NextResponse.json(
        { error: "Este recurso exige Premium." },
        { status: 403, headers: { "Cache-Control": "no-store, private" } },
      );
    return NextResponse.json(
      { allowed: true, feature: requested },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  }
  return NextResponse.json(
    await getUserEntitlements(authenticated.account.id),
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
