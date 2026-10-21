import { NextRequest, NextResponse } from "next/server";
import {
  getDevelopmentPrincipal,
  getRequestSession,
  publicAccount,
} from "@/services/auth/auth-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authenticated = await getRequestSession(request, {
    allowUnverified: true,
  });
  const development = authenticated ? null : getDevelopmentPrincipal();
  return NextResponse.json(
    {
      account: authenticated
        ? publicAccount(authenticated.account)
        : (development?.account ?? null),
      demo: Boolean(development),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
