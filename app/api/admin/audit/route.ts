import { NextRequest, NextResponse } from "next/server";
import { listAdminAudit } from "@/services/admin/audit-store";
import { requireRole } from "@/services/auth/auth-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await requireRole(request, "ADMIN")))
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  return NextResponse.json(
    { entries: await listAdminAudit(100) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
