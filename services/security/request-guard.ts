import "server-only";

import type { NextRequest } from "next/server";
import { isProductionLike } from "@/services/security/environment";

type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

export function getClientAddress(request: NextRequest) {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "untrusted-network";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  return forwarded?.trim() || request.headers.get("x-real-ip") || "local";
}

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  current.count += 1;
  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
  };
}

export function isTrustedMutation(request: NextRequest) {
  const marker = request.headers.get("x-logiclab-request");
  const fetchSite = request.headers.get("sec-fetch-site");
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const expectedOrigin = (() => {
    try {
      return configuredOrigin ? new URL(configuredOrigin).origin : null;
    } catch {
      return null;
    }
  })();
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const requestHost = request.headers.get("host");
      const localRequestOrigin = requestHost
        ? `${request.nextUrl.protocol}//${requestHost}`
        : request.nextUrl.origin;
      const acceptedOrigin = isProductionLike()
        ? expectedOrigin
        : localRequestOrigin;
      if (!acceptedOrigin) return false;
      if (new URL(origin).origin !== acceptedOrigin) return false;
    } catch {
      return false;
    }
  } else if (isProductionLike() && !expectedOrigin) {
    return false;
  }
  if (
    marker === "same-origin" &&
    (!fetchSite || fetchSite === "same-origin" || fetchSite === "none")
  ) {
    return true;
  }
  return Boolean(origin);
}

export type JsonBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 413; error: string };

export async function readJsonBody<T>(
  request: NextRequest,
  maxChars = 16_000,
): Promise<JsonBodyResult<T>> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxChars)
    return { ok: false, status: 413, error: "SolicitaÃ§Ã£o muito grande." };
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, error: "Dados invÃ¡lidos." };
  }
  if (raw.length > maxChars)
    return { ok: false, status: 413, error: "SolicitaÃ§Ã£o muito grande." };
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false, status: 400, error: "JSON invÃ¡lido." };
  }
}

export function safeUserAgent(request: NextRequest) {
  return (request.headers.get("user-agent") || "Navegador desconhecido").slice(
    0,
    240,
  );
}

export function describeDevice(userAgent: string) {
  const browser = /edg/i.test(userAgent)
    ? "Edge"
    : /firefox/i.test(userAgent)
      ? "Firefox"
      : /chrome|chromium/i.test(userAgent)
        ? "Chrome"
        : /safari/i.test(userAgent)
          ? "Safari"
          : "Navegador";
  const system = /android/i.test(userAgent)
    ? "Android"
    : /iphone|ipad/i.test(userAgent)
      ? "iOS"
      : /windows/i.test(userAgent)
        ? "Windows"
        : /mac os/i.test(userAgent)
          ? "macOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "dispositivo";
  return `${browser} — ${system}`;
}
