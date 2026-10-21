export const XP_REWARDS = {
  easy: 10,
  medium: 25,
  hard: 50,
  expert: 100,
  review: 15,
  dailyChallengeBonus: 30,
  workoutCompletionBonus: 40,
  noHintBonus: 10,
  weeklyMission: 120,
} as const;

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1_000, 1_350, 1_750, 2_200, 2_700, 3_300, 3_950, 4_650,
  5_400, 6_200, 7_050, 7_950, 8_900, 9_900, 10_950,
] as const;

export const LEVEL_REWARDS = [
  {
    level: 2,
    id: "badge-primeiros-passos",
    type: "badge",
    title: "Primeiros Passos",
  },
  { level: 3, id: "tema-editor-aurora", type: "theme", title: "Tema Aurora" },
  { level: 5, id: "python", type: "language", title: "Python" },
  {
    level: 5,
    id: "tokens-nivel-5",
    type: "tokens",
    title: "2 tokens de ajuda",
    amount: 2,
  },
  {
    level: 7,
    id: "desafio-especial-7",
    type: "challenge",
    title: "Desafio especial",
  },
  { level: 10, id: "java", type: "language", title: "Java" },
  {
    level: 10,
    id: "badge-pensador-logico",
    type: "badge",
    title: "Pensador Lógico",
  },
  {
    level: 10,
    id: "projeto-sistema-notas",
    type: "project",
    title: "Projeto Sistema de notas",
  },
  { level: 12, id: "tema-editor-oceano", type: "theme", title: "Tema Oceano" },
  { level: 15, id: "c", type: "language", title: "C" },
  {
    level: 15,
    id: "badge-baixo-nivel",
    type: "badge",
    title: "Explorador de memória",
  },
  { level: 20, id: "cpp", type: "language", title: "C++" },
  {
    level: 20,
    id: "projeto-despesas",
    type: "project",
    title: "Gerenciador de despesas",
  },
] as const;

export const SKILL_CATALOG = [
  { id: "algoritmos", title: "Algoritmos" },
  { id: "variaveis", title: "Variáveis" },
  { id: "tipos", title: "Tipos de dados" },
  { id: "operadores", title: "Operadores" },
  { id: "condicoes", title: "Condições" },
  { id: "loops", title: "Loops" },
  { id: "funcoes", title: "Funções" },
  { id: "arrays", title: "Arrays e listas" },
  { id: "debugging", title: "Debugging" },
  { id: "decomposicao", title: "Decomposição" },
  { id: "resolucao", title: "Resolução de problemas" },
] as const;

export const LANGUAGE_CATALOG = [
  {
    id: "javascript",
    name: "JavaScript",
    version: "ES2023",
    requiredLevel: 1,
    requiredSkills: [],
    minimumMastery: 0,
    executor: "browser",
  },
  {
    id: "python",
    name: "Python",
    version: "3.12",
    requiredLevel: 5,
    requiredSkills: ["variaveis", "condicoes"],
    minimumMastery: 35,
    executor: "external-required",
  },
  {
    id: "java",
    name: "Java",
    version: "21",
    requiredLevel: 10,
    requiredSkills: ["condicoes", "loops", "funcoes"],
    minimumMastery: 75,
    executor: "external-required",
  },
  {
    id: "c",
    name: "C",
    version: "C17",
    requiredLevel: 15,
    requiredSkills: ["algoritmos", "debugging"],
    minimumMastery: 75,
    executor: "external-required",
  },
  {
    id: "cpp",
    name: "C++",
    version: "C++20",
    requiredLevel: 20,
    requiredSkills: ["algoritmos", "debugging", "decomposicao"],
    minimumMastery: 80,
    executor: "external-required",
  },
] as const;

export type LanguageId = (typeof LANGUAGE_CATALOG)[number]["id"];
export type SkillId = (typeof SKILL_CATALOG)[number]["id"];

export function getLevelForXp(xp: number) {
  const normalizedXp = Math.max(0, Math.floor(xp));
  const knownIndex = [...LEVEL_THRESHOLDS].findLastIndex(
    (threshold) => normalizedXp >= threshold,
  );
  if (knownIndex < LEVEL_THRESHOLDS.length - 1) return knownIndex + 1;

  let level = LEVEL_THRESHOLDS.length;
  let threshold = LEVEL_THRESHOLDS.at(-1) ?? 0;
  let increment = 1_100;
  while (normalizedXp >= threshold + increment) {
    threshold += increment;
    increment += 100;
    level += 1;
  }
  return level;
}

export function getXpThresholdForLevel(level: number) {
  const normalizedLevel = Math.max(1, Math.floor(level));
  if (normalizedLevel <= LEVEL_THRESHOLDS.length)
    return LEVEL_THRESHOLDS[normalizedLevel - 1];

  let threshold = LEVEL_THRESHOLDS.at(-1) ?? 0;
  let increment = 1_100;
  for (
    let currentLevel = LEVEL_THRESHOLDS.length + 1;
    currentLevel <= normalizedLevel;
    currentLevel += 1
  ) {
    threshold += increment;
    increment += 100;
  }
  return threshold;
}

export function getLevelProgress(xp: number) {
  const level = getLevelForXp(xp);
  const currentThreshold = getXpThresholdForLevel(level);
  const nextThreshold = getXpThresholdForLevel(level + 1);
  const earnedInLevel = Math.max(0, xp - currentThreshold);
  const levelRange = Math.max(1, nextThreshold - currentThreshold);
  return {
    level,
    currentThreshold,
    nextThreshold,
    earnedInLevel,
    levelRange,
    percent: Math.min(100, Math.round((earnedInLevel / levelRange) * 100)),
  };
}
