import { NextRequest, NextResponse } from "next/server";

function continueRequest(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-logiclab-pathname",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function proxy(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== "true") return continueRequest(request);

  const { pathname } = request.nextUrl;
  const allowed =
    pathname === "/manutencao" ||
    pathname === "/api/status" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/_next/");

  if (allowed) return continueRequest(request);
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Serviço temporariamente em manutenção.",
        statusUrl: "/api/status",
      },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

  return NextResponse.rewrite(new URL("/manutencao", request.url), {
    status: 503,
    headers: { "Retry-After": "300" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
