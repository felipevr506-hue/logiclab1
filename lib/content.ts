import { appConfig } from "@/lib/config";
import type { Exercise } from "@/lib/types";

const coreExercises: Exercise[] = [
  {
    id: "variaveis",
    title: "Seu primeiro dado",
    concept: "Variáveis",
    difficulty: "Fácil",
    minutes: 5,
    xp: appConfig.xp.easy,
    objective: "Guardar um nome em uma variável e exibi-lo no console.",
    instructions: [
      'Crie uma variável chamada nome com o valor "Ada".',
      "Use console.log para mostrar: Olá, Ada!",
    ],
    starterCode:
      '// Guarde o nome em uma variável\nconst nome = "";\n\n// Mostre a mensagem no console\nconsole.log();',
    solution: 'const nome = "Ada";\nconsole.log(`Olá, ${nome}!`);',
    explanation:
      'Uma variável associa um nome a um valor. Aqui, `nome` guarda o texto "Ada" e o template literal monta a mensagem final.',
    hints: [
      "Uma variável com valor fixo pode ser criada com const.",
      "O texto esperado começa com Olá e termina com um ponto de exclamação.",
      'Experimente: const nome = "Ada" e use ${nome} dentro de crases.',
    ],
    tests: [
      {
        id: "v1",
        label: "A variável nome foi criada",
        expression: "typeof nome",
        expected: "string",
        feedback: "Crie uma variável chamada nome contendo texto.",
      },
      {
        id: "v2",
        label: "O nome correto foi armazenado",
        expression: "nome",
        expected: "Ada",
        feedback: 'Confira se o valor de nome é exatamente "Ada".',
      },
      {
        id: "v3",
        label: "A mensagem foi exibida",
        expectedLogs: ["Olá, Ada!"],
        feedback: "Monte a frase completa e envie-a para console.log.",
      },
    ],
  },
  {
    id: "condicoes",
    title: "Decisões no código",
    concept: "Condições",
    difficulty: "Médio",
    minutes: 7,
    xp: appConfig.xp.medium,
    objective: "Tomar uma decisão com base na nota recebida.",
    instructions: [
      "Complete a função avaliarNota(nota).",
      'Retorne "Aprovado" quando a nota for maior ou igual a 7.',
      'Caso contrário, retorne "Reprovado".',
    ],
    starterCode:
      "function avaliarNota(nota) {\n  // Escreva sua condição aqui\n  \n}",
    solution:
      'function avaliarNota(nota) {\n  if (nota >= 7) {\n    return "Aprovado";\n  }\n  return "Reprovado";\n}',
    explanation:
      "A condição precisa incluir o limite 7. Por isso usamos >=, que significa maior ou igual. O segundo retorno cobre todos os demais casos.",
    hints: [
      "A decisão pode ser escrita com if.",
      "Preste atenção ao caso em que a nota é exatamente 7.",
      "A estrutura começa com: if (nota >= 7) { ... }.",
    ],
    runExample: {
      label: "Nota para testar",
      help: "Esse valor fica disponível como input e será usado em avaliarNota(input).",
      defaultValue: "7",
      inputKind: "number",
      expression: "avaliarNota(input)",
    },
    tests: [
      {
        id: "c1",
        label: "Nota acima da média",
        expression: "avaliarNota(9)",
        expected: "Aprovado",
        feedback: "Notas acima de 7 devem ser aprovadas.",
      },
      {
        id: "c2",
        label: "Nota no limite (7)",
        expression: "avaliarNota(7)",
        expected: "Aprovado",
        feedback: "Seu programa parece não incluir a nota exatamente 7.",
      },
      {
        id: "c3",
        label: "Nota abaixo da média",
        expression: "avaliarNota(6)",
        expected: "Reprovado",
        feedback: "Notas abaixo de 7 devem ser reprovadas.",
      },
      {
        id: "c4",
        label: "Nota zero",
        expression: "avaliarNota(0)",
        expected: "Reprovado",
        feedback: "Confira o caminho alternativo da condição.",
      },
    ],
  },
  {
    id: "loops",
    title: "Repetir sem copiar",
    concept: "Loops",
    exerciseType: "debugging",
    difficulty: "Médio",
    minutes: 7,
    xp: appConfig.xp.medium,
    objective: "Usar repetição para construir uma sequência de 1 até 10.",
    instructions: [
      "Complete a função listarNumeros().",
      "Use um loop para adicionar os números de 1 até 10 ao array numeros.",
      "Retorne o array ao final.",
    ],
    starterCode:
      "function listarNumeros() {\n  const numeros = [];\n  \n  // Este loop possui um bug. Encontre e corrija.\n  for (let numero = 1; numero <= 10; numero--) {\n    numeros.push(numero);\n  }\n  \n  return numeros;\n}",
    solution:
      "function listarNumeros() {\n  const numeros = [];\n  for (let numero = 1; numero <= 10; numero++) {\n    numeros.push(numero);\n  }\n  return numeros;\n}",
    explanation:
      "O contador começa em 1, continua enquanto for menor ou igual a 10 e cresce uma unidade por repetição. push adiciona cada valor à lista.",
    hints: [
      "Um loop for reúne início, condição e incremento.",
      "O contador deve começar em 1 e incluir o 10.",
      "Use numeros.push(numero) dentro de for (let numero = 1; numero <= 10; numero++).",
    ],
    tests: [
      {
        id: "l1",
        label: "Começa no número 1",
        expression: "listarNumeros()[0]",
        expected: 1,
        feedback: "A sequência deve começar em 1.",
      },
      {
        id: "l2",
        label: "Termina no número 10",
        expression: "listarNumeros()[9]",
        expected: 10,
        feedback: "A condição do loop precisa incluir o 10.",
      },
      {
        id: "l3",
        label: "Possui dez itens",
        expression: "listarNumeros().length",
        expected: 10,
        feedback: "Confira o início, o limite e o incremento do loop.",
      },
    ],
  },
  {
    id: "listas",
    title: "Uma turma inteira",
    concept: "Listas",
    difficulty: "Médio",
    minutes: 6,
    xp: appConfig.xp.medium,
    objective: "Percorrer uma lista e transformar cada nome.",
    instructions: [
      "Complete nomesDosAlunos(alunos).",
      'Retorne uma nova lista com "Aluno: " antes de cada nome.',
      "Não altere a lista original.",
    ],
    starterCode:
      "function nomesDosAlunos(alunos) {\n  // Percorra e transforme a lista\n  \n}",
    solution:
      "function nomesDosAlunos(alunos) {\n  return alunos.map((nome) => `Aluno: ${nome}`);\n}",
    explanation:
      "map percorre todos os itens e devolve uma nova lista. Isso preserva o array original e deixa clara a transformação aplicada.",
    hints: [
      "Você precisa devolver uma nova lista com o mesmo tamanho.",
      "O método map é apropriado para transformar cada item.",
      "Dentro do map, retorne `Aluno: ${nome}`.",
    ],
    runExample: {
      label: "Lista para testar (JSON)",
      help: "Use uma lista JSON; ela fica disponível como input.",
      defaultValue: '["Ana", "Leo"]',
      inputKind: "json",
      expression: "nomesDosAlunos(input)",
    },
    tests: [
      {
        id: "a1",
        label: "Transforma dois alunos",
        expression: "nomesDosAlunos(['Ana','Leo'])",
        expected: ["Aluno: Ana", "Aluno: Leo"],
        feedback: "Aplique o prefixo a cada nome da lista.",
      },
      {
        id: "a2",
        label: "Funciona com lista vazia",
        expression: "nomesDosAlunos([])",
        expected: [],
        feedback: "Uma lista vazia deve resultar em outra lista vazia.",
      },
    ],
  },
  {
    id: "calculadora",
    title: "Desafio: calculadora",
    concept: "Decomposição",
    difficulty: "Desafio",
    minutes: 10,
    xp: appConfig.xp.challenge,
    objective: "Combinar funções e condições em uma calculadora simples.",
    instructions: [
      "Complete calcular(a, b, operacao).",
      "Aceite as operações +, -, * e /.",
      'Retorne "Operação inválida" para qualquer outro símbolo.',
    ],
    starterCode:
      "function calcular(a, b, operacao) {\n  // Divida o problema em quatro casos\n  \n}",
    solution:
      "function calcular(a, b, operacao) {\n  if (operacao === '+') return a + b;\n  if (operacao === '-') return a - b;\n  if (operacao === '*') return a * b;\n  if (operacao === '/') return a / b;\n  return 'Operação inválida';\n}",
    explanation:
      "O problema fica simples quando cada operação vira um caso independente. Depois dos quatro casos conhecidos, o retorno final trata entradas inválidas.",
    hints: [
      "Comece tratando apenas a soma. Depois repita o raciocínio.",
      "Compare operacao com cada símbolo usando ===.",
      "Use uma condição por operação e deixe o retorno inválido por último.",
    ],
    runExample: {
      label: "Valores para testar (JSON)",
      help: "Informe a, b e operacao; o objeto fica disponível como input.",
      defaultValue: '{"a": 5, "b": 3, "operacao": "+"}',
      inputKind: "json",
      expression: "calcular(input.a, input.b, input.operacao)",
    },
    tests: [
      {
        id: "d1",
        label: "Soma",
        expression: "calcular(5, 3, '+')",
        expected: 8,
        feedback: "Confira o caso da soma.",
      },
      {
        id: "d2",
        label: "Subtração",
        expression: "calcular(5, 3, '-')",
        expected: 2,
        feedback: "Confira o caso da subtração.",
      },
      {
        id: "d3",
        label: "Multiplicação",
        expression: "calcular(5, 3, '*')",
        expected: 15,
        feedback: "Confira o caso da multiplicação.",
      },
      {
        id: "d4",
        label: "Divisão",
        expression: "calcular(12, 3, '/')",
        expected: 4,
        feedback: "Confira o caso da divisão.",
      },
      {
        id: "d5",
        label: "Operação desconhecida",
        expression: "calcular(1, 1, '%')",
        expected: "Operação inválida",
        feedback: "Inclua um retorno para operações desconhecidas.",
      },
    ],
  },
  {
    id: "funcoes",
    title: "Funções que podem ser reutilizadas",
    concept: "Funções",
    difficulty: "Médio",
    minutes: 8,
    xp: appConfig.xp.medium,
    objective: "Criar uma função que calcula o dobro de qualquer número.",
    instructions: [
      "Complete a função calcularDobro(numero).",
      "Retorne o número recebido multiplicado por 2.",
      "A função deve funcionar com valores positivos, negativos e zero.",
    ],
    starterCode:
      "function calcularDobro(numero) {\n  // Retorne o dobro do valor recebido\n  \n}",
    solution: "function calcularDobro(numero) {\n  return numero * 2;\n}",
    explanation:
      "Uma função recebe dados pelos parâmetros e devolve um resultado com return. A mesma regra pode ser reutilizada com qualquer número.",
    hints: [
      "Use return para devolver um valor.",
      "O dobro é obtido multiplicando o número por 2.",
      "A linha principal pode ser escrita como return numero * 2.",
    ],
    runExample: {
      label: "Número para testar",
      help: "O valor fica disponível como input e será usado em calcularDobro(input).",
      defaultValue: "6",
      inputKind: "number",
      expression: "calcularDobro(input)",
    },
    tests: [
      {
        id: "f1",
        label: "Dobra um número positivo",
        expression: "calcularDobro(6)",
        expected: 12,
        feedback: "Multiplique o parâmetro recebido por 2.",
      },
      {
        id: "f2",
        label: "Preserva o zero",
        expression: "calcularDobro(0)",
        expected: 0,
        feedback: "Zero multiplicado por 2 continua sendo zero.",
      },
      {
        id: "f3",
        label: "Funciona com número negativo",
        expression: "calcularDobro(-4)",
        expected: -8,
        feedback: "A mesma multiplicação deve funcionar com números negativos.",
      },
    ],
  },
  {
    id: "textos",
    title: "Validando uma mensagem",
    concept: "Strings",
    difficulty: "Médio",
    minutes: 8,
    xp: appConfig.xp.medium,
    objective: "Analisar um texto e informar se ele possui conteúdo.",
    instructions: [
      "Complete a função validarMensagem(mensagem).",
      'Retorne "Válida" quando o texto, sem espaços nas pontas, possuir conteúdo.',
      'Retorne "Vazia" nos demais casos.',
    ],
    starterCode:
      "function validarMensagem(mensagem) {\n  // Remova espaços extras e tome uma decisão\n  \n}",
    solution:
      "function validarMensagem(mensagem) {\n  if (mensagem.trim().length > 0) return 'Válida';\n  return 'Vazia';\n}",
    explanation:
      "trim remove espaços do começo e do fim. Depois disso, length permite verificar se ainda existe algum caractere útil.",
    hints: [
      "O método trim remove espaços externos.",
      "Compare o tamanho do texto tratado com zero.",
      "Teste mensagem.trim().length > 0 dentro de um if.",
    ],
    runExample: {
      label: "Mensagem para testar",
      help: "O texto fica disponível como input e será usado em validarMensagem(input).",
      defaultValue: "Olá",
      inputKind: "text",
      expression: "validarMensagem(input)",
    },
    tests: [
      {
        id: "s1",
        label: "Aceita uma mensagem",
        expression: "validarMensagem('Olá')",
        expected: "Válida",
        feedback: "Um texto com caracteres deve ser considerado válido.",
      },
      {
        id: "s2",
        label: "Rejeita texto vazio",
        expression: "validarMensagem('')",
        expected: "Vazia",
        feedback: "Uma string vazia deve seguir o caminho alternativo.",
      },
      {
        id: "s3",
        label: "Rejeita apenas espaços",
        expression: "validarMensagem('   ')",
        expected: "Vazia",
        feedback: "Remova os espaços antes de conferir o tamanho.",
      },
    ],
  },
];

const earlyExerciseDefinitions = [
  {
    id: "primeiros-passos",
    sourceId: "variaveis",
    title: "Seu primeiro algoritmo",
    concept: "Algoritmos",
  },
  {
    id: "tipos-de-dados",
    sourceId: "textos",
    title: "Reconhecendo textos",
    concept: "Tipos de dados",
  },
  {
    id: "operadores",
    sourceId: "calculadora",
    title: "Operadores na prática",
    concept: "Operadores",
  },
  {
    id: "comparacoes",
    sourceId: "condicoes",
    title: "Comparando valores",
    concept: "Comparações",
  },
  {
    id: "repeticoes-iniciais",
    sourceId: "loops",
    title: "Primeiras repetições",
    concept: "Sequências",
  },
  {
    id: "arrays-iniciais",
    sourceId: "listas",
    title: "Organizando uma coleção",
    concept: "Arrays",
  },
  {
    id: "funcoes-iniciais",
    sourceId: "funcoes",
    title: "Minha primeira função",
    concept: "Revisão dos fundamentos",
  },
] as const;

export const exercises: Exercise[] = [
  ...earlyExerciseDefinitions.map((definition, index) => {
    const source = coreExercises.find(
      (exercise) => exercise.id === definition.sourceId,
    );
    if (!source)
      throw new Error(`Exercício base ausente: ${definition.sourceId}`);
    return {
      ...source,
      id: definition.id,
      title: definition.title,
      concept: definition.concept,
      difficulty: index < 3 ? ("Fácil" as const) : source.difficulty,
      xp: index < 3 ? appConfig.xp.easy : source.xp,
      tests: source.tests.map((test) => ({
        ...test,
        id: `${definition.id}-${test.id}`,
      })),
    };
  }),
  ...coreExercises,
];

export const levels = [
  {
    number: "01",
    title: "Fundamentos",
    description: "Algoritmos, sequência, variáveis e tipos de dados.",
    progress: 72,
    status: "current",
  },
  {
    number: "02",
    title: "Construindo lógica",
    description: "Operadores, entrada, saída e condições.",
    progress: 28,
    status: "available",
  },
  {
    number: "03",
    title: "Pensando como programador",
    description: "Loops, listas e funções.",
    progress: 0,
    status: "locked",
  },
  {
    number: "04",
    title: "Resolução de problemas",
    description: "Decomposição, padrões e desafios compostos.",
    progress: 0,
    status: "locked",
  },
  {
    number: "05",
    title: "Projetos",
    description: "Mini projetos e desafios finais.",
    progress: 0,
    status: "locked",
  },
] as const;

export const lesson = {
  eyebrow: "Nível 02 · Treino 08",
  title: "Condições: ensinando o código a decidir",
  description:
    "Hoje você vai transformar uma regra do mundo real em uma decisão que o JavaScript entende.",
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
      text: "Quando a condição é verdadeira, o bloco dentro de if é executado. Caso contrário, seguimos outro caminho.",
    },
    {
      marker: "03",
      title: "Os limites importam",
      text: "Maior que (>) e maior ou igual (>=) parecem próximos, mas produzem respostas diferentes no valor-limite.",
    },
  ],
};

export const findExercise = (id: string) =>
  exercises.find((exercise) => exercise.id === id);
