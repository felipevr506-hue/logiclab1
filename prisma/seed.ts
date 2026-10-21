import {
  PrismaClient,
  ContentStatus,
  Difficulty,
  RewardType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL é obrigatória para o seed.");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const levelThresholds = [
  0, 100, 250, 450, 700, 1_000, 1_350, 1_750, 2_200, 2_700, 3_300, 3_950, 4_650,
  5_400, 6_200, 7_050, 7_950, 8_900, 9_900, 10_950,
];

const rewards = [
  [2, "badge-primeiros-passos", RewardType.BADGE, "Primeiros Passos"],
  [3, "tema-editor-aurora", RewardType.THEME, "Tema Aurora"],
  [5, "python", RewardType.LANGUAGE, "Python"],
  [5, "tokens-nivel-5", RewardType.TOKENS, "2 tokens de ajuda"],
  [7, "desafio-especial-7", RewardType.CHALLENGE, "Desafio especial"],
  [10, "java", RewardType.LANGUAGE, "Java"],
  [10, "badge-pensador-logico", RewardType.BADGE, "Pensador Lógico"],
  [10, "projeto-sistema-notas", RewardType.PROJECT, "Sistema de notas"],
  [12, "tema-editor-oceano", RewardType.THEME, "Tema Oceano"],
  [15, "c", RewardType.LANGUAGE, "C"],
  [15, "badge-baixo-nivel", RewardType.BADGE, "Explorador de memória"],
  [20, "cpp", RewardType.LANGUAGE, "C++"],
  [20, "projeto-despesas", RewardType.PROJECT, "Gerenciador de despesas"],
] as const;

const languages = [
  {
    slug: "javascript",
    name: "JavaScript",
    version: "ES2023",
    executor: "browser",
    requiredLevel: 1,
    requiredSkills: [],
    minimumMastery: 0,
  },
  {
    slug: "python",
    name: "Python",
    version: "3.12",
    executor: "external-required",
    requiredLevel: 5,
    requiredSkills: ["variaveis", "condicoes"],
    minimumMastery: 35,
  },
  {
    slug: "java",
    name: "Java",
    version: "21",
    executor: "external-required",
    requiredLevel: 10,
    requiredSkills: ["condicoes", "loops", "funcoes"],
    minimumMastery: 75,
  },
  {
    slug: "c",
    name: "C",
    version: "C17",
    executor: "external-required",
    requiredLevel: 15,
    requiredSkills: ["algoritmos", "debugging"],
    minimumMastery: 75,
  },
  {
    slug: "cpp",
    name: "C++",
    version: "C++20",
    executor: "external-required",
    requiredLevel: 20,
    requiredSkills: ["algoritmos", "debugging", "decomposicao"],
    minimumMastery: 80,
  },
] as const;

const skills = [
  ["algoritmos", "Algoritmos"],
  ["variaveis", "Variáveis"],
  ["tipos", "Tipos de dados"],
  ["operadores", "Operadores"],
  ["condicoes", "Condições"],
  ["loops", "Loops"],
  ["funcoes", "Funções"],
  ["arrays", "Arrays e listas"],
  ["debugging", "Debugging"],
  ["decomposicao", "Decomposição"],
  ["resolucao", "Resolução de problemas"],
] as const;

async function main() {
  const path = await prisma.learningPath.upsert({
    where: { slug: "logica-com-javascript" },
    update: {},
    create: {
      slug: "logica-com-javascript",
      title: "Lógica com JavaScript",
      description:
        "Trilha inicial de demonstração para desenvolver raciocínio lógico.",
      language: "javascript",
      order: 1,
      status: ContentStatus.PUBLISHED,
    },
  });

  const level = await prisma.level.upsert({
    where: { learningPathId_order: { learningPathId: path.id, order: 1 } },
    update: {},
    create: {
      learningPathId: path.id,
      title: "Fundamentos",
      description: "Variáveis, tipos e sequência lógica.",
      order: 1,
    },
  });

  const lesson = await prisma.lesson.upsert({
    where: { slug: "primeiros-dados" },
    update: {},
    create: {
      levelId: level.id,
      slug: "primeiros-dados",
      title: "Seu primeiro dado",
      summary: "Aprenda a guardar e exibir informações.",
      content: {
        blocks: [
          {
            type: "paragraph",
            text: "Uma variável associa um nome a um valor.",
          },
        ],
      },
      estimatedMinutes: 20,
      order: 1,
      status: ContentStatus.PUBLISHED,
    },
  });

  await prisma.exercise.upsert({
    where: { slug: "variavel-nome" },
    update: {},
    create: {
      lessonId: lesson.id,
      slug: "variavel-nome",
      title: "Seu primeiro dado",
      description: "Crie uma variável nome e exiba uma saudação.",
      concept: "Variáveis",
      difficulty: Difficulty.EASY,
      starterCode: "const nome = '';\nconsole.log();",
      solutionCode: "const nome = 'Ada';\nconsole.log(`Olá, ${nome}!`);",
      explanation: "const declara uma referência que não será reatribuída.",
      xp: 10,
      order: 1,
      status: ContentStatus.PUBLISHED,
      tests: {
        create: [
          { label: "Nome armazenado", expected: "Ada", order: 1 },
          { label: "Mensagem exibida", expected: "Olá, Ada!", order: 2 },
        ],
      },
      hints: {
        create: [
          { content: "Use const para guardar um valor fixo.", order: 1 },
          { content: "O valor esperado para nome é Ada.", order: 2 },
        ],
      },
    },
  });

  for (const [index, requiredXp] of levelThresholds.entries()) {
    const levelNumber = index + 1;
    await prisma.xpLevel.upsert({
      where: { level: levelNumber },
      update: { requiredXp, title: `Nível ${levelNumber}` },
      create: {
        level: levelNumber,
        requiredXp,
        title: `Nível ${levelNumber}`,
      },
    });
  }

  for (const [levelNumber, slug, type, title] of rewards) {
    const reward = await prisma.reward.upsert({
      where: { slug },
      update: { type, title },
      create: {
        slug,
        type,
        title,
        description: `Recompensa concedida ao alcançar o nível ${levelNumber}.`,
        payload:
          type === RewardType.TOKENS
            ? { amount: 2 }
            : type === RewardType.LANGUAGE
              ? { languageId: slug }
              : undefined,
      },
    });
    const xpLevel = await prisma.xpLevel.findUniqueOrThrow({
      where: { level: levelNumber },
    });
    await prisma.levelReward.upsert({
      where: {
        levelId_rewardId: { levelId: xpLevel.id, rewardId: reward.id },
      },
      update: {},
      create: { levelId: xpLevel.id, rewardId: reward.id },
    });
  }

  for (const definition of languages) {
    const language = await prisma.language.upsert({
      where: { slug: definition.slug },
      update: {
        name: definition.name,
        version: definition.version,
        executor: definition.executor,
      },
      create: {
        slug: definition.slug,
        name: definition.name,
        version: definition.version,
        executor: definition.executor,
      },
    });
    await prisma.languageUnlockRequirement.upsert({
      where: { languageId: language.id },
      update: {
        requiredLevel: definition.requiredLevel,
        requiredSkills: [...definition.requiredSkills],
        minimumMastery: definition.minimumMastery,
      },
      create: {
        languageId: language.id,
        requiredLevel: definition.requiredLevel,
        requiredSkills: [...definition.requiredSkills],
        minimumMastery: definition.minimumMastery,
      },
    });
  }

  for (const [slug, title] of skills) {
    await prisma.skill.upsert({
      where: { slug },
      update: { title },
      create: {
        slug,
        title,
        description: `Domínio adaptativo de ${title.toLocaleLowerCase("pt-BR")}.`,
      },
    });
  }

  const mission = await prisma.weeklyMission.upsert({
    where: { slug: "fundamentos-semanais" },
    update: { xpReward: 120, active: true },
    create: {
      slug: "fundamentos-semanais",
      title: "Missão da semana",
      description: "Pratique com consistência e valide conceitos diferentes.",
      xpReward: 120,
    },
  });
  const missionObjectives = [
    ["complete-three", "Conclua 3 exercícios", "completedExercises", 3],
    [
      "medium-one",
      "Resolva 1 exercício médio ou difícil",
      "mediumCompletions",
      1,
    ],
    ["no-hint-one", "Resolva 1 exercício sem dica", "noHintCompletions", 1],
  ] as const;
  for (const [index, objective] of missionObjectives.entries()) {
    const [slug, label, metric, target] = objective;
    await prisma.missionObjective.upsert({
      where: { missionId_slug: { missionId: mission.id, slug } },
      update: { label, metric, target, order: index + 1 },
      create: {
        missionId: mission.id,
        slug,
        label,
        metric,
        target,
        order: index + 1,
      },
    });
  }

  const projectDefinitions = [
    {
      slug: "calculadora",
      title: "Calculadora confiável",
      description: "Combine dados, operadores e decomposição.",
      requiredLevel: 3,
      xpReward: 150,
      steps: [
        ["dados", "Receber números", "variaveis"],
        ["operacoes", "Escolher a operação", "operadores"],
        ["finalizar", "Tratar todos os casos", "calculadora"],
      ],
    },
    {
      slug: "sistema-notas",
      title: "Sistema de notas",
      description: "Modele notas, decisões e listas em etapas.",
      requiredLevel: 10,
      xpReward: 250,
      steps: [
        ["tipos", "Validar os dados", "tipos-de-dados"],
        ["decisao", "Classificar a nota", "condicoes"],
        ["turma", "Processar a turma", "listas"],
      ],
    },
  ] as const;
  for (const definition of projectDefinitions) {
    const project = await prisma.project.upsert({
      where: { slug: definition.slug },
      update: {
        title: definition.title,
        description: definition.description,
        requiredLevel: definition.requiredLevel,
        xpReward: definition.xpReward,
      },
      create: {
        slug: definition.slug,
        title: definition.title,
        description: definition.description,
        requiredLevel: definition.requiredLevel,
        xpReward: definition.xpReward,
      },
    });
    for (const [index, step] of definition.steps.entries()) {
      const [slug, title, exerciseId] = step;
      await prisma.projectStep.upsert({
        where: { projectId_slug: { projectId: project.id, slug } },
        update: { title, exerciseId, order: index + 1 },
        create: {
          projectId: project.id,
          slug,
          title,
          exerciseId,
          order: index + 1,
        },
      });
    }
  }

  const achievementDefinitions = [
    [
      "primeira-solucao",
      "Primeira solução",
      "Concluiu o primeiro exercício válido.",
    ],
    ["sem-ajuda", "Primeira solução sem ajuda", "Resolveu sem utilizar dicas."],
    [
      "debugger-iniciante",
      "Debugger iniciante",
      "Desenvolveu domínio em debugging.",
    ],
    [
      "habilidade-dominada",
      "Habilidade dominada",
      "Alcançou 80% em uma habilidade.",
    ],
    [
      "nova-linguagem",
      "Primeira linguagem adicional",
      "Desbloqueou outra linguagem.",
    ],
    [
      "primeiro-projeto",
      "Primeiro projeto concluído",
      "Concluiu todas as etapas.",
    ],
  ] as const;
  for (const [slug, title, description] of achievementDefinitions) {
    await prisma.achievement.upsert({
      where: { slug },
      update: { title, description },
      create: { slug, title, description, icon: "trophy" },
    });
  }

  await prisma.challenge.upsert({
    where: { slug: "debug-loop" },
    update: { active: true },
    create: {
      slug: "debug-loop",
      title: "Corrija o contador",
      description: "Encontre a causa de um loop que nunca termina.",
      difficulty: Difficulty.MEDIUM,
      xpReward: 25,
    },
  });

  await prisma.assessment.upsert({
    where: { slug: "fundamentos-javascript" },
    update: { active: true },
    create: {
      slug: "fundamentos-javascript",
      title: "Fundamentos de JavaScript",
      description: "Avaliação sem dicas para medir domínio atual.",
      exerciseIds: ["variaveis", "condicoes", "loops"],
      optionalMinutes: 30,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
