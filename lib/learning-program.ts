import { XP_REWARDS } from "@/lib/gamification-config";

export const WEEKLY_MISSION = {
  id: "fundamentos-semanais",
  title: "Missão da semana",
  description: "Pratique com consistência e valide conceitos diferentes.",
  xpReward: XP_REWARDS.weeklyMission,
  objectives: [
    {
      id: "complete-three",
      label: "Conclua 3 exercícios",
      target: 3,
      metric: "completedExercises",
    },
    {
      id: "medium-one",
      label: "Resolva 1 exercício médio ou difícil",
      target: 1,
      metric: "mediumCompletions",
    },
    {
      id: "no-hint-one",
      label: "Resolva 1 exercício sem dica",
      target: 1,
      metric: "noHintCompletions",
    },
  ],
} as const;

export const PROJECT_CATALOG = [
  {
    id: "calculadora",
    title: "Calculadora confiável",
    description:
      "Combine dados, operadores e decomposição para construir uma calculadora.",
    language: "javascript",
    requiredLevel: 3,
    xpReward: 150,
    steps: [
      {
        id: "dados",
        title: "Receber números",
        exerciseId: "variaveis",
      },
      {
        id: "operacoes",
        title: "Escolher a operação",
        exerciseId: "operadores",
      },
      {
        id: "finalizar",
        title: "Tratar todos os casos",
        exerciseId: "calculadora",
      },
    ],
  },
  {
    id: "sistema-notas",
    title: "Sistema de notas",
    description:
      "Modele notas, decisões e uma lista de resultados em etapas independentes.",
    language: "javascript",
    requiredLevel: 10,
    xpReward: 250,
    steps: [
      {
        id: "tipos",
        title: "Validar os dados",
        exerciseId: "tipos-de-dados",
      },
      {
        id: "decisao",
        title: "Classificar a nota",
        exerciseId: "condicoes",
      },
      {
        id: "turma",
        title: "Processar a turma",
        exerciseId: "listas",
      },
    ],
  },
] as const;

export type ProjectId = (typeof PROJECT_CATALOG)[number]["id"];

export const ACHIEVEMENT_CATALOG = [
  {
    id: "achievement-primeira-solucao",
    title: "Primeira solução",
    description: "Concluiu o primeiro exercício válido.",
  },
  {
    id: "achievement-sem-ajuda",
    title: "Primeira solução sem ajuda",
    description: "Resolveu um exercício sem utilizar dicas.",
  },
  {
    id: "achievement-debugger-iniciante",
    title: "Debugger iniciante",
    description: "Demonstrou domínio inicial em debugging.",
  },
  {
    id: "achievement-habilidade-dominada",
    title: "Habilidade dominada",
    description: "Alcançou 80% de domínio em uma habilidade.",
  },
  {
    id: "achievement-nova-linguagem",
    title: "Primeira linguagem adicional",
    description: "Desbloqueou uma linguagem além de JavaScript.",
  },
  {
    id: "achievement-primeiro-projeto",
    title: "Primeiro projeto concluído",
    description: "Concluiu todas as etapas de um projeto.",
  },
] as const;
