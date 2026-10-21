import {
  LANGUAGE_CATALOG,
  LEVEL_REWARDS,
  getLevelForXp,
  type LanguageId,
} from "@/lib/gamification-config";
import type {
  AppState,
  ProgrammingLanguageId,
  RewardGrant,
  UserLanguage,
  XPAwardSummary,
  XPReason,
  XPTransaction,
} from "@/lib/types";
import { hasEntitlement } from "@/services/entitlements/entitlements";

export type AwardXPRequest = {
  amount: number;
  reason: XPReason;
  uniqueKey: string;
  description: string;
  exerciseId?: string;
  workoutId?: string;
  challengeId?: string;
  projectId?: string;
  missionId?: string;
  createdAt?: string;
};

export type LanguageRequirementProgress = {
  languageId: LanguageId;
  level: { current: number; required: number; complete: boolean };
  skills: Array<{
    skillId: string;
    current: number;
    required: number;
    complete: boolean;
  }>;
  completed: number;
  total: number;
  canUnlock: boolean;
};

function createId(prefix: string) {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function getTotalXp(transactions: XPTransaction[]) {
  return transactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );
}

export function getLanguageRequirementProgress(
  state: Pick<AppState, "level" | "userSkills">,
  languageId: LanguageId,
): LanguageRequirementProgress {
  const language = LANGUAGE_CATALOG.find(
    (candidate) => candidate.id === languageId,
  )!;
  const level = {
    current: state.level,
    required: language.requiredLevel,
    complete: state.level >= language.requiredLevel,
  };
  const skills = language.requiredSkills.map((skillId) => {
    const current = state.userSkills[skillId]?.masteryScore ?? 0;
    return {
      skillId,
      current,
      required: language.minimumMastery,
      complete: current >= language.minimumMastery,
    };
  });
  const completed =
    Number(level.complete) + skills.filter((skill) => skill.complete).length;
  const total = 1 + skills.length;
  return {
    languageId,
    level,
    skills,
    completed,
    total,
    canUnlock: completed === total,
  };
}

function unlockEligibleLanguages(
  state: Pick<AppState, "level" | "user" | "userSkills" | "userLanguages">,
  createdAt: string,
) {
  const currentIds = new Set(
    state.userLanguages.map((language) => language.languageId),
  );
  const unlocked: UserLanguage[] = [...state.userLanguages];
  const newLanguageIds: ProgrammingLanguageId[] = [];
  for (const language of LANGUAGE_CATALOG) {
    if (currentIds.has(language.id)) continue;
    const requirements = getLanguageRequirementProgress(
      { level: state.level, userSkills: state.userSkills },
      language.id,
    );
    const planAllowsLanguage = hasEntitlement(
      state.user.plan,
      `language:${language.id}`,
    );
    if (!requirements.canUnlock || !planAllowsLanguage) continue;
    unlocked.push({
      languageId: language.id,
      unlockedAt: createdAt,
      unlockedBy:
        language.id === "javascript"
          ? "initial"
          : "plan",
      progressPercent: 0,
    });
    currentIds.add(language.id);
    newLanguageIds.push(language.id);
  }

  return { userLanguages: unlocked, newLanguageIds };
}

function grantEligibleRewards(
  state: Pick<
    AppState,
    "level" | "rewardGrants" | "userLanguages" | "helpTokens"
  >,
  createdAt: string,
) {
  const existingIds = new Set(
    state.rewardGrants.map((grant) => grant.rewardId),
  );
  const unlockedLanguageIds = new Set(
    state.userLanguages.map((language) => language.languageId),
  );
  const grants: RewardGrant[] = [];
  let helpTokens = state.helpTokens;

  for (const reward of LEVEL_REWARDS) {
    if (reward.level > state.level || existingIds.has(reward.id)) continue;
    if (
      reward.type === "language" &&
      !unlockedLanguageIds.has(reward.id as LanguageId)
    )
      continue;
    const grant: RewardGrant = {
      id: createId("reward"),
      rewardId: reward.id,
      level: reward.level,
      type: reward.type,
      title: reward.title,
      amount: "amount" in reward ? reward.amount : undefined,
      grantedAt: createdAt,
    };
    grants.push(grant);
    existingIds.add(reward.id);
    if (reward.type === "tokens") helpTokens += reward.amount;
  }

  return { grants, helpTokens };
}

export function reconcileProgressionState(
  state: AppState,
  createdAt = new Date().toISOString(),
) {
  const xp = getTotalXp(state.xpTransactions);
  const level = getLevelForXp(xp);
  const languageResult = unlockEligibleLanguages(
    {
      level,
      user: state.user,
      userSkills: state.userSkills,
      userLanguages: state.userLanguages,
    },
    createdAt,
  );
  const rewardResult = grantEligibleRewards(
    {
      level,
      rewardGrants: state.rewardGrants,
      userLanguages: languageResult.userLanguages,
      helpTokens: state.helpTokens,
    },
    createdAt,
  );
  return {
    ...state,
    xp,
    level,
    userLanguages: languageResult.userLanguages,
    rewardGrants: [...state.rewardGrants, ...rewardResult.grants],
    helpTokens: rewardResult.helpTokens,
  };
}

export function awardXP(
  state: AppState,
  requests: AwardXPRequest | AwardXPRequest[],
) {
  const entries = Array.isArray(requests) ? requests : [requests];
  const createdAt = entries[0]?.createdAt ?? new Date().toISOString();
  const previousLevel = getLevelForXp(getTotalXp(state.xpTransactions));
  const existingKeys = new Set(
    state.xpTransactions.map((transaction) => transaction.uniqueKey),
  );
  const transactions: XPTransaction[] = [];

  for (const request of entries) {
    if (
      !Number.isInteger(request.amount) ||
      request.amount <= 0 ||
      !request.uniqueKey.trim() ||
      existingKeys.has(request.uniqueKey)
    )
      continue;
    const transaction: XPTransaction = {
      id: createId("xp"),
      amount: request.amount,
      reason: request.reason,
      uniqueKey: request.uniqueKey,
      description: request.description,
      exerciseId: request.exerciseId,
      workoutId: request.workoutId,
      challengeId: request.challengeId,
      projectId: request.projectId,
      missionId: request.missionId,
      createdAt: request.createdAt ?? createdAt,
    };
    transactions.push(transaction);
    existingKeys.add(request.uniqueKey);
  }

  const withTransactions: AppState = {
    ...state,
    xpTransactions: [...state.xpTransactions, ...transactions],
  };
  const reconciled = reconcileProgressionState(withTransactions, createdAt);
  const currentLevel = reconciled.level;
  const previousRewardIds = new Set(
    state.rewardGrants.map((grant) => grant.rewardId),
  );
  const previousLanguageIds = new Set(
    state.userLanguages.map((language) => language.languageId),
  );
  const summary: XPAwardSummary = {
    amount: transactions.reduce(
      (total, transaction) => total + transaction.amount,
      0,
    ),
    transactionIds: transactions.map((transaction) => transaction.id),
    previousLevel,
    currentLevel,
    levelsGained: Array.from(
      { length: Math.max(0, currentLevel - previousLevel) },
      (_, index) => previousLevel + index + 1,
    ),
    rewards: reconciled.rewardGrants.filter(
      (grant) => !previousRewardIds.has(grant.rewardId),
    ),
    languagesUnlocked: reconciled.userLanguages
      .filter((language) => !previousLanguageIds.has(language.languageId))
      .map((language) => language.languageId),
    duplicate: transactions.length === 0,
    createdAt,
  };

  return { ...reconciled, lastXpAward: summary };
}
