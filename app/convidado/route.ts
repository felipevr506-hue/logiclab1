import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GUEST_COOKIE, guestAccount } from "@/services/auth/guest";
import { clearSessionCookie, sessionCookieOptions } from "@/services/auth/http";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "Acesso recusado." }, { status: 403 });
  const previous = request.cookies.get(GUEST_COOKIE)?.value;
  const token = guestAccount(previous) ? previous! : randomUUID();
  const response = clearSessionCookie(
    NextResponse.redirect(new URL("/dashboard", request.url), 303),
  );
  response.cookies.set(GUEST_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: 60 * 60 * 24 * 30,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
