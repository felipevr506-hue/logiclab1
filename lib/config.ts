import { XP_REWARDS } from "@/lib/gamification-config";
import { PLAN_CATALOG } from "@/services/payments/plans";

export const appConfig = {
  name: "LogicLab",
  tagline: "Lógica se aprende praticando.",
  workoutMinutes: { min: 20, max: 30 },
  monthlyPriceInCents: PLAN_CATALOG["premium-monthly"].priceInCents,
  freeExerciseLimit: 3,
  masteryThreshold: 0.75,
  xp: {
    easy: XP_REWARDS.easy,
    medium: XP_REWARDS.medium,
    challenge: XP_REWARDS.hard,
    hard: XP_REWARDS.hard,
    expert: XP_REWARDS.expert,
    review: XP_REWARDS.review,
    dailyChallengeBonus: XP_REWARDS.dailyChallengeBonus,
    workoutBonus: XP_REWARDS.workoutCompletionBonus,
    noHintBonus: XP_REWARDS.noHintBonus,
  },
} as const;

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
