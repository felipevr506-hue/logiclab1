import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./readability.css";
import { AppStateProvider } from "@/lib/app-state";

const publicUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(publicUrl),
  title: {
    default: "LogicLab — Treine lógica de programação",
    template: "%s · LogicLab",
  },
  description:
    "Treinos diários de 20–30 minutos para desenvolver lógica de programação e resolver problemas com confiança.",
  keywords: [
    "lógica de programação",
    "JavaScript",
    "exercícios",
    "aprender programação",
  ],
  openGraph: {
    title: "LogicLab — Pare de assistir. Comece a praticar.",
    description:
      "Uma academia de lógica de programação, com treinos curtos e prática guiada.",
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "LogicLab",
  },
  alternates: { canonical: "/", languages: { "pt-BR": "/" } },
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
