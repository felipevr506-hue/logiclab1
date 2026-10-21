export type PlanId = "free" | "premium-monthly";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceInCents: number;
  currency: "BRL";
  interval: "month" | null;
  active: boolean;
  features: readonly string[];
};

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceInCents: 0,
    currency: "BRL",
    interval: null,
    active: true,
    features: [
      "Primeiras aulas e exercícios",
      "Execução de código JavaScript",
      "5 ajudas do Tutor por dia",
      "Progresso inicial persistente",
    ],
  },
  "premium-monthly": {
    id: "premium-monthly",
    name: "Premium",
    priceInCents: 3_990,
    currency: "BRL",
    interval: "month",
    active: true,
    features: [
      "Trilhas completas",
      "Tutor IA ampliado",
      "Projetos práticos",
      "Linguagens avançadas",
      "Revisão espaçada",
      "Relatório semanal",
      "Portfólio",
    ],
  },
};

export function getPlan(planId: string) {
  return PLAN_CATALOG[planId as PlanId] ?? null;
}

const ENGLISH_FEATURES: Record<PlanId, readonly string[]> = {
  free: [
    "First lessons and exercises",
    "JavaScript code execution",
    "5 Tutor requests per day",
    "Persistent initial progress",
  ],
  "premium-monthly": [
    "Complete learning paths",
    "Expanded AI Tutor",
    "Practical projects",
    "Advanced languages",
    "Spaced review",
    "Weekly report",
    "Portfolio",
  ],
};

export function getPlanFeatures(plan: PlanDefinition, locale = "pt-BR") {
  return locale.toLowerCase().startsWith("en")
    ? ENGLISH_FEATURES[plan.id]
    : plan.features;
}

export function formatPlanPrice(
  plan: Pick<PlanDefinition, "priceInCents" | "currency">,
  locale = "pt-BR",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: plan.currency,
  }).format(plan.priceInCents / 100);
}
