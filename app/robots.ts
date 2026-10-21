import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/cadastro", "/entrar", "/termos", "/privacidade"],
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/perfil",
        "/seguranca",
        "/treino/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
