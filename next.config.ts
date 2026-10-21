import type { NextConfig } from "next";

const appEnvironment = process.env.APP_ENV?.toLowerCase();
const allowsDevelopmentRuntime =
  process.env.NODE_ENV === "development" ||
  appEnvironment === "development" ||
  appEnvironment === "test";
const productionLike = !allowsDevelopmentRuntime;

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  ...(allowsDevelopmentRuntime
    ? { allowedDevOrigins: ["127.0.0.1", "localhost"] }
    : {}),
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Isolated test servers change database/email configuration between runs.
    // Reusing their Turbopack filesystem cache produced spurious route 404s.
    ...(appEnvironment === "test"
      ? { turbopackFileSystemCacheForDev: false }
      : {}),
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          `script-src 'self' 'unsafe-inline'${allowsDevelopmentRuntime ? " 'unsafe-eval'" : ""}`,
          "connect-src 'self'",
          "worker-src 'self' blob:",
          "object-src 'none'",
          ...(productionLike ? ["upgrade-insecure-requests"] : []),
        ].join("; "),
      },
    ];
    if (productionLike)
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
