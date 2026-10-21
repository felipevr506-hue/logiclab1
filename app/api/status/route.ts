import { NextResponse } from "next/server";
import { authMode } from "@/services/auth/auth-store";
import { databasePersistenceMode } from "@/services/persistence/database";
import { appEnvironment } from "@/services/security/environment";

export function GET() {
  const environment = appEnvironment();
  const authenticationMode = authMode();
  const persistence = databasePersistenceMode();
  const maintenance = process.env.MAINTENANCE_MODE === "true";
  const browserExecutorEnabled =
    environment === "development" ||
    environment === "test" ||
    process.env.NEXT_PUBLIC_BROWSER_EXECUTOR_ENABLED === "true";
  const emailReady =
    process.env.AUTH_EMAIL_DELIVERY === "resend" &&
    Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
  const billingReady =
    process.env.BILLING_PROVIDER === "hotmart" &&
    Boolean(
      process.env.HOTMART_CHECKOUT_URL &&
        process.env.HOTMART_WEBHOOK_SECRET &&
        process.env.HOTMART_PRODUCT_ID,
    );

  const productionBlockers = [
    ...(persistence !== "postgres"
      ? ["DATABASE_URL/PostgreSQL precisa ser configurado e receber as migrations."]
      : []),
    ...(!emailReady
      ? ["Resend precisa de RESEND_API_KEY e AUTH_EMAIL_FROM para entregar e-mails."]
      : []),
    ...(!billingReady
      ? ["Checkout Hotmart, Hottok e produto precisam ser configurados e testados no sandbox."]
      : []),
    "Rate limit distribuído e alertas operacionais ainda exigem Redis/infraestrutura externa.",
    "O executor externo isolado para código não confiável ainda não foi conectado.",
    "Testes/soluções didáticas ainda precisam sair do bundle do navegador antes da produção.",
  ];

  return NextResponse.json(
    {
      status: maintenance ? "maintenance" : "ok",
      health: productionBlockers.length ? "degraded" : "operational",
      productionReady: productionBlockers.length === 0,
      productionBlockers,
      app: "LogicLab",
      environment,
      mode: persistence === "postgres" ? "postgres" : "local-development",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      services: {
        web: { status: "operational" },
        database: {
          status: persistence,
          detail:
            persistence === "postgres"
              ? "Prisma usa PostgreSQL para identidade, perfil, progresso e billing."
              : "O fallback em arquivo é permitido somente em desenvolvimento/teste.",
        },
        authentication: {
          status: authenticationMode === "required" ? "operational" : "demo-only",
          detail: "Sessões opacas em cookie HttpOnly; tokens são armazenados somente como hash.",
        },
        payments: {
          status: billingReady ? "configured" : "not-configured",
          detail: billingReady
            ? "Hotmart com contexto de checkout e webhook autenticado/idempotente."
            : "Nenhuma cobrança é iniciada enquanto a configuração estiver incompleta.",
        },
        email: {
          status: emailReady ? "configured" : "not-configured",
          detail: emailReady
            ? "Entrega transacional via Resend."
            : "Links locais só aparecem fora de produção no modo console.",
        },
        javascriptExecutor: {
          status: browserExecutorEnabled ? "development-only" : "blocked",
        },
        maintenance: { status: maintenance ? "active" : "inactive" },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
