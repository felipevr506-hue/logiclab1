import { NextRequest, NextResponse } from "next/server";
import { GUEST_COOKIE } from "@/services/auth/guest";
import { sessionCookieOptions } from "@/services/auth/http";

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/entrar", request.url), 303);
  response.cookies.set(GUEST_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
