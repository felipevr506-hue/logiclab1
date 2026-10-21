import { NextRequest, NextResponse } from "next/server";
import { getTutorUsageSummary } from "@/services/ai/usage-store";
import { requireRole } from "@/services/auth/auth-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await requireRole(request, "ADMIN")))
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  return NextResponse.json({
    tutor: await getTutorUsageSummary(),
    executor: {
      mode: "client-side",
      estimatedServerCpuMs: 0,
      detail: "Web Worker local; não há custo de CPU no servidor.",
    },
  });
}
