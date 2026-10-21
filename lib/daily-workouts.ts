export type DailyWorkout = {
  id: string;
  day: number;
  exerciseId: string;
  eyebrow: string;
  title: string;
  shortTitle: string;
  description: string;
  duration: number;
  learn: Array<{
    marker: string;
    title: string;
    text: string;
  }>;
  outcomes: string[];
};

export const dailyWorkouts: DailyWorkout[] = [
  {
    id: "treino-01",
    day: 1,
    exerciseId: "primeiros-passos",
    eyebrow: "Nível 01 · Treino 01",
    title: "Algoritmos: seu primeiro passo",
    shortTitle: "Primeiro algoritmo",
    description:
      "Organize instruções simples e produza a primeira saída em JavaScript.",
    duration: 16,
    learn: [
      {
        marker: "01",
        title: "Um algoritmo é uma sequência",
        text: "Cada instrução prepara o resultado da próxima etapa.",
      },
      {
        marker: "02",
        title: "Nomes tornam dados compreensíveis",
        text: "Uma variável identifica o valor que será usado pelo programa.",
      },
      {
        marker: "03",
        title: "O console mostra o resultado",
        text: "console.log permite observar a saída produzida pelo algoritmo.",
      },
    ],
    outcomes: ["Ordenar instruções", "Guardar um valor", "Exibir uma saída"],
  },
  {
    id: "treino-02",
    day: 2,
    exerciseId: "tipos-de-dados",
    eyebrow: "Nível 01 · Treino 02",
    title: "Tipos de dados: entendendo textos",
    shortTitle: "Textos e dados",
    description:
      "Reconheça strings, trate espaços e diferencie conteúdo útil de texto vazio.",
    duration: 17,
    learn: [
      {
        marker: "01",
        title: "Strings representam textos",
        text: "Aspas delimitam os caracteres que fazem parte de uma mensagem.",
      },
      {
        marker: "02",
        title: "Métodos transformam valores",
        text: "trim cria uma versão do texto sem espaços nas extremidades.",
      },
      {
        marker: "03",
        title: "Propriedades descrevem o dado",
        text: "length informa quantos caracteres existem depois do tratamento.",
      },
    ],
    outcomes: ["Reconhecer strings", "Tratar espaços", "Medir um texto"],
  },
  {
    id: "treino-03",
    day: 3,
    exerciseId: "operadores",
    eyebrow: "Nível 01 · Treino 03",
    title: "Operadores: calculando resultados",
    shortTitle: "Operadores na prática",
    description:
      "Use símbolos matemáticos e escolha a operação adequada para cada entrada.",
    duration: 19,
    learn: [
      {
        marker: "01",
        title: "Operadores combinam valores",
        text: "Soma, subtração, multiplicação e divisão produzem novos números.",
      },
      {
        marker: "02",
        title: "A entrada define a operação",
        text: "O símbolo recebido indica qual cálculo deve ser executado.",
      },
      {
        marker: "03",
        title: "Casos desconhecidos precisam de resposta",
        text: "Uma saída clara evita resultados silenciosos ou indefinidos.",
      },
    ],
    outcomes: [
      "Usar operadores",
      "Escolher um cálculo",
      "Tratar símbolos inválidos",
    ],
  },
  {
    id: "treino-04",
    day: 4,
    exerciseId: "comparacoes",
    eyebrow: "Nível 02 · Treino 04",
    title: "Comparações: verdadeiro ou falso",
    shortTitle: "Comparando valores",
    description:
      "Compare números e entenda como valores-limite alteram uma decisão.",
    duration: 19,
    learn: [
      {
        marker: "01",
        title: "Comparações produzem booleanos",
        text: "O resultado de uma comparação é sempre verdadeiro ou falso.",
      },
      {
        marker: "02",
        title: "Cada símbolo possui uma regra",
        text: "Maior que e maior ou igual tratam o limite de formas diferentes.",
      },
      {
        marker: "03",
        title: "Teste os extremos",
        text: "Valores no limite revelam erros que exemplos comuns não mostram.",
      },
    ],
    outcomes: ["Comparar números", "Ler booleanos", "Testar valores-limite"],
  },
  {
    id: "treino-05",
    day: 5,
    exerciseId: "repeticoes-iniciais",
    eyebrow: "Nível 02 · Treino 05",
    title: "Sequências: repetindo passos",
    shortTitle: "Primeiras repetições",
    description:
      "Use um contador para repetir instruções e construir uma sequência completa.",
    duration: 20,
    learn: [
      {
        marker: "01",
        title: "Repetir evita cópias",
        text: "Um loop expressa uma regra em vez de duplicar a mesma linha.",
      },
      {
        marker: "02",
        title: "O contador acompanha o passo",
        text: "Seu valor muda a cada execução do bloco de repetição.",
      },
      {
        marker: "03",
        title: "Todo loop precisa terminar",
        text: "A condição de parada protege o programa de uma repetição infinita.",
      },
    ],
    outcomes: [
      "Criar sequências",
      "Atualizar contadores",
      "Definir uma parada",
    ],
  },
  {
    id: "treino-06",
    day: 6,
    exerciseId: "arrays-iniciais",
    eyebrow: "Nível 02 · Treino 06",
    title: "Arrays: organizando coleções",
    shortTitle: "Coleções de dados",
    description:
      "Agrupe vários valores, percorra os itens e produza uma coleção transformada.",
    duration: 20,
    learn: [
      {
        marker: "01",
        title: "Arrays guardam vários itens",
        text: "Uma única variável pode representar uma coleção ordenada.",
      },
      {
        marker: "02",
        title: "Cada item pode ser transformado",
        text: "map aplica a mesma regra para todos os elementos.",
      },
      {
        marker: "03",
        title: "O original pode ser preservado",
        text: "Criar uma nova lista evita alterações inesperadas na entrada.",
      },
    ],
    outcomes: ["Criar arrays", "Percorrer itens", "Transformar uma coleção"],
  },
  {
    id: "treino-07",
    day: 7,
    exerciseId: "funcoes-iniciais",
    eyebrow: "Nível 02 · Treino 07",
    title: "Revisão: reunindo os fundamentos",
    shortTitle: "Revisão dos fundamentos",
    description:
      "Combine parâmetros, operadores e retorno em uma função pequena e reutilizável.",
    duration: 21,
    learn: [
      {
        marker: "01",
        title: "Funções recebem entradas",
        text: "Parâmetros levam valores para dentro de uma regra.",
      },
      {
        marker: "02",
        title: "O corpo processa os dados",
        text: "Operadores transformam a entrada no resultado esperado.",
      },
      {
        marker: "03",
        title: "return devolve a resposta",
        text: "O valor retornado pode alimentar outras partes do programa.",
      },
    ],
    outcomes: [
      "Receber parâmetros",
      "Processar valores",
      "Retornar uma resposta",
    ],
  },
  {
    id: "treino-08",
    day: 8,
    exerciseId: "condicoes",
    eyebrow: "Nível 02 · Treino 08",
    title: "Condições: ensinando o código a decidir",
    shortTitle: "Decisões com condições",
    description:
      "Transforme uma regra do mundo real em uma decisão que o JavaScript entende.",
    duration: 24,
    learn: [
      {
        marker: "01",
        title: "Toda decisão tem uma pergunta",
        text: "Uma condição avalia uma pergunta cuja resposta só pode ser verdadeira ou falsa.",
      },
      {
        marker: "02",
        title: "if executa um caminho",
        text: "Quando a condição é verdadeira, o bloco dentro de if é executado.",
      },
      {
        marker: "03",
        title: "Os limites importam",
        text: "Maior que e maior ou igual parecem próximos, mas mudam o valor-limite.",
      },
    ],
    outcomes: [
      "Comparar valores",
      "Criar caminhos com if/else",
      "Tratar limites",
    ],
  },
  {
    id: "treino-09",
    day: 9,
    exerciseId: "loops",
    eyebrow: "Nível 03 · Treino 09",
    title: "Loops: repetindo com intenção",
    shortTitle: "Repetições inteligentes",
    description:
      "Construa sequências sem copiar linhas e entenda quando uma repetição deve parar.",
    duration: 22,
    learn: [
      {
        marker: "01",
        title: "Repetição precisa de controle",
        text: "Um contador registra em qual passo da sequência o programa está.",
      },
      {
        marker: "02",
        title: "A condição define o limite",
        text: "O loop continua somente enquanto sua condição for verdadeira.",
      },
      {
        marker: "03",
        title: "O incremento evita loops infinitos",
        text: "Alterar o contador aproxima a repetição do seu ponto de parada.",
      },
    ],
    outcomes: [
      "Criar um loop for",
      "Controlar o contador",
      "Evitar repetição infinita",
    ],
  },
  {
    id: "treino-10",
    day: 10,
    exerciseId: "listas",
    eyebrow: "Nível 03 · Treino 10",
    title: "Listas: transformando vários valores",
    shortTitle: "Listas e transformação",
    description:
      "Percorra coleções de dados e produza uma nova lista sem alterar a original.",
    duration: 21,
    learn: [
      {
        marker: "01",
        title: "Uma lista reúne valores relacionados",
        text: "Arrays permitem trabalhar com vários itens usando uma única referência.",
      },
      {
        marker: "02",
        title: "map transforma cada item",
        text: "A função fornecida ao map é executada para todos os elementos.",
      },
      {
        marker: "03",
        title: "A lista original é preservada",
        text: "map devolve um novo array e mantém os dados recebidos intactos.",
      },
    ],
    outcomes: [
      "Percorrer listas",
      "Transformar com map",
      "Preservar o array original",
    ],
  },
  {
    id: "treino-11",
    day: 11,
    exerciseId: "calculadora",
    eyebrow: "Nível 04 · Treino 11",
    title: "Decomposição: construindo uma calculadora",
    shortTitle: "Desafio da calculadora",
    description:
      "Divida um problema maior em casos pequenos e trate entradas desconhecidas.",
    duration: 27,
    learn: [
      {
        marker: "01",
        title: "Separe um caso por vez",
        text: "Resolver primeiro a soma reduz a quantidade de decisões simultâneas.",
      },
      {
        marker: "02",
        title: "Cada operador escolhe um caminho",
        text: "Comparações exatas ligam o símbolo recebido à operação correta.",
      },
      {
        marker: "03",
        title: "Sempre trate o inesperado",
        text: "Um retorno final explica quando nenhuma operação conhecida foi escolhida.",
      },
    ],
    outcomes: [
      "Decompor problemas",
      "Combinar condições",
      "Tratar entradas inválidas",
    ],
  },
  {
    id: "treino-12",
    day: 12,
    exerciseId: "variaveis",
    eyebrow: "Nível 01 · Treino 12",
    title: "Variáveis: dando nome aos dados",
    shortTitle: "Dados e mensagens",
    description:
      "Guarde informações, reutilize valores e monte uma mensagem clara no console.",
    duration: 18,
    learn: [
      {
        marker: "01",
        title: "Variáveis guardam valores",
        text: "Um nome claro permite encontrar e reutilizar uma informação no programa.",
      },
      {
        marker: "02",
        title: "const protege referências",
        text: "Use const quando a variável não precisa receber outro valor depois.",
      },
      {
        marker: "03",
        title: "Templates combinam texto e dados",
        text: "Crases e interpolação montam mensagens sem concatenações difíceis de ler.",
      },
    ],
    outcomes: [
      "Declarar variáveis",
      "Escolher nomes claros",
      "Montar mensagens",
    ],
  },
  {
    id: "treino-13",
    day: 13,
    exerciseId: "funcoes",
    eyebrow: "Nível 03 · Treino 13",
    title: "Funções: lógica que pode ser reutilizada",
    shortTitle: "Funções reutilizáveis",
    description:
      "Receba dados por parâmetros e devolva resultados previsíveis com return.",
    duration: 20,
    learn: [
      {
        marker: "01",
        title: "Parâmetros são entradas",
        text: "Eles permitem executar a mesma lógica com valores diferentes.",
      },
      {
        marker: "02",
        title: "return entrega a resposta",
        text: "O valor retornado pode ser usado por outras partes do programa.",
      },
      {
        marker: "03",
        title: "Uma responsabilidade por função",
        text: "Funções pequenas são mais simples de entender, testar e reutilizar.",
      },
    ],
    outcomes: [
      "Definir parâmetros",
      "Retornar resultados",
      "Reutilizar uma regra",
    ],
  },
  {
    id: "treino-14",
    day: 14,
    exerciseId: "textos",
    eyebrow: "Nível 03 · Treino 14",
    title: "Strings: validando mensagens",
    shortTitle: "Textos e validação",
    description:
      "Trate espaços, confira o tamanho de textos e reconheça entradas vazias.",
    duration: 20,
    learn: [
      {
        marker: "01",
        title: "Textos também possuem estrutura",
        text: "Strings oferecem métodos e propriedades para analisar seu conteúdo.",
      },
      {
        marker: "02",
        title: "trim remove espaços externos",
        text: "Isso evita considerar uma sequência de espaços como conteúdo útil.",
      },
      {
        marker: "03",
        title: "length mede o resultado tratado",
        text: "Depois da limpeza, o tamanho informa se ainda existe uma mensagem.",
      },
    ],
    outcomes: [
      "Tratar strings",
      "Remover espaços externos",
      "Validar conteúdo vazio",
    ],
  },
];

export const BRASILIA_TIME_ZONE = "America/Sao_Paulo";
export const ROTATION_ANCHOR_DATE_KEY = "2026-08-07";
const rotationAnchorDay = Date.UTC(2026, 7, 7);

export function getBrasiliaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRASILIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function getBrasiliaDateKey(date = new Date()) {
  const { year, month, day } = getBrasiliaDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateKeyToDayNumber(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  return new Date(dateKeyToDayNumber(dateKey) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function validDateKey(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function getUserTrainingStartDate(trainingStartedOn?: string) {
  return validDateKey(trainingStartedOn)
    ? (trainingStartedOn as string)
    : ROTATION_ANCHOR_DATE_KEY;
}

export function getDailyWorkout(date = new Date(), trainingStartedOn?: string) {
  const anchorDay = trainingStartedOn
    ? dateKeyToDayNumber(getUserTrainingStartDate(trainingStartedOn))
    : rotationAnchorDay;
  const elapsedDays = Math.floor(
    (dateKeyToDayNumber(getBrasiliaDateKey(date)) - anchorDay) / 86_400_000,
  );
  const activeDay = Math.max(0, elapsedDays);
  const index =
    ((activeDay % dailyWorkouts.length) + dailyWorkouts.length) %
    dailyWorkouts.length;
  return dailyWorkouts[index];
}

export function getUserDailyWorkout(
  trainingStartedOn?: string,
  date = new Date(),
) {
  return getDailyWorkout(date, getUserTrainingStartDate(trainingStartedOn));
}

export function getWorkoutForExercise(exerciseId: string) {
  return dailyWorkouts.find((workout) => workout.exerciseId === exerciseId);
}

export function getWorkoutSchedule(
  date = new Date(),
  trainingStartedOn?: string,
) {
  const currentWorkout = getDailyWorkout(date, trainingStartedOn);
  const todayKey = getBrasiliaDateKey(date);
  const cycleStart = trainingStartedOn
    ? getUserTrainingStartDate(trainingStartedOn)
    : addDaysToDateKey(todayKey, -(currentWorkout.day - 1));
  return dailyWorkouts.map((workout) => {
    const dateKey = addDaysToDateKey(cycleStart, workout.day - 1);
    const dateLabel = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${dateKey}T12:00:00Z`));
    return {
      ...workout,
      dateKey,
      dateLabel,
      isCurrent: workout.id === currentWorkout.id,
      isUnlocked: dateKeyToDayNumber(dateKey) <= dateKeyToDayNumber(todayKey),
    };
  });
}

export function getUserWorkoutSchedule(
  trainingStartedOn?: string,
  date = new Date(),
) {
  return getWorkoutSchedule(date, getUserTrainingStartDate(trainingStartedOn));
}

export function isUserWorkoutUnlocked(
  workout: DailyWorkout,
  trainingStartedOn?: string,
  date = new Date(),
) {
  const releaseDate = addDaysToDateKey(
    getUserTrainingStartDate(trainingStartedOn),
    workout.day - 1,
  );
  return (
    dateKeyToDayNumber(releaseDate) <=
    dateKeyToDayNumber(getBrasiliaDateKey(date))
  );
}

export function formatDailyDate(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRASILIA_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(date)
    .toLocaleUpperCase("pt-BR");
}
