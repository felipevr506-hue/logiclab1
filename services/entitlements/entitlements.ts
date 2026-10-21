import type { ProgrammingLanguageId } from "@/lib/types";

export type ProductPlan = "free" | "pro";
export type EntitlementKey =
  | "full_learning_path"
  | "advanced_tutor"
  | "projects"
  | "portfolio"
  | "spaced_review"
  | "weekly_report"
  | "playground"
  | `language:${ProgrammingLanguageId}`;

export const PLAN_LIMITS = {
  free: {
    tutorRequestsPerDay: 5,
    executionsPerDay: 30,
    playgroundExecutionsPerDay: 15,
    exercises: 3,
  },
  pro: {
    tutorRequestsPerDay: 80,
    executionsPerDay: 300,
    playgroundExecutionsPerDay: 150,
    exercises: Number.POSITIVE_INFINITY,
  },
} as const;

const proFeatures = new Set<EntitlementKey>([
  "full_learning_path",
  "advanced_tutor",
  "projects",
  "portfolio",
  "spaced_review",
  "weekly_report",
  "language:python",
  "language:java",
  "language:c",
  "language:cpp",
]);

export const ENTITLEMENT_KEYS: readonly EntitlementKey[] = [
  "full_learning_path",
  "advanced_tutor",
  "projects",
  "portfolio",
  "spaced_review",
  "weekly_report",
  "playground",
  "language:javascript",
  "language:python",
  "language:java",
  "language:c",
  "language:cpp",
];

export function hasEntitlement(plan: ProductPlan, feature: EntitlementKey) {
  if (feature === "playground" || feature === "language:javascript")
    return true;
  return plan === "pro" && proFeatures.has(feature);
}

export function getPlanLimits(plan: ProductPlan) {
  return PLAN_LIMITS[plan];
}

export function listEntitlements(plan: ProductPlan) {
  return ENTITLEMENT_KEYS.filter((feature) => hasEntitlement(plan, feature));
}
