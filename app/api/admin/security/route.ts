import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/services/auth/auth-store";
import { listSecurityEvents } from "@/services/security/event-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await requireRole(request, "ADMIN")))
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  return NextResponse.json(
    { entries: await listSecurityEvents(100) },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
