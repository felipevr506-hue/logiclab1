import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/services/auth/auth-store";
import { databasePersistenceMode, getPrisma } from "@/services/persistence/database";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await requireRole(request, "ADMIN")))
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (databasePersistenceMode() !== "postgres")
    return NextResponse.json({ subscriptions: [], total: 0 });
  const page = Math.max(1, Math.min(10_000, Number(request.nextUrl.searchParams.get("page")) || 1));
  const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit")) || 50));
  const prisma = getPrisma();
  const [subscriptions, total] = await prisma.$transaction([
    prisma.subscription.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        planId: true,
        status: true,
        provider: true,
        providerCustomerId: true,
        providerSubscriptionId: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { email: true, profile: { select: { name: true } } },
        },
      },
    }),
    prisma.subscription.count(),
  ]);
  return NextResponse.json(
    { subscriptions, total, page, limit },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
