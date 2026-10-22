import { NextRequest, NextResponse } from "next/server";
import { GUEST_COOKIE, guestAccount } from "@/services/auth/guest";
import {
  getDevelopmentPrincipal,
  getRequestSession,
  publicAccount,
} from "@/services/auth/auth-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const guest = guestAccount(request.cookies.get(GUEST_COOKIE)?.value);
  if (guest)
    return NextResponse.json(
      { account: guest, demo: true },
      { headers: { "Cache-Control": "no-store" } },
    );
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
