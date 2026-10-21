import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return ["", "/cadastro", "/entrar", "/termos", "/privacidade"].map(
    (path, index) => ({
      url: `${base}${path}`,
      lastModified: new Date(),
      changeFrequency: index === 0 ? "weekly" : "monthly",
      priority: index === 0 ? 1 : index < 3 ? 0.8 : 0.4,
    }),
  );
}
