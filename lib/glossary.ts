import type { ProgrammingLanguageId } from "@/lib/types";

export type GlossaryEntry = {
  id: string;
  term: string;
  definition: string;
  example: string;
  languages: ProgrammingLanguageId[];
  relatedExerciseIds: string[];
  aliases?: string[];
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "algoritmo",
    term: "Algoritmo",
    definition:
      "Sequência finita de passos para transformar uma entrada em um resultado.",
    example: "ler preço → aplicar desconto → mostrar total",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["primeiros-passos"],
  },
  {
    id: "variavel",
    term: "Variável",
    definition:
      "Nome usado para guardar um valor que o programa poderá consultar ou alterar.",
    example: "const idade = 18;",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["variaveis"],
  },
  {
    id: "tipo",
    term: "Tipo de dado",
    definition:
      "Categoria de um valor, como número, texto, booleano ou coleção.",
    example: "typeof 42 // 'number'",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["tipos-de-dados"],
    aliases: ["tipagem", "dados"],
  },
  {
    id: "operador",
    term: "Operador",
    definition:
      "Símbolo ou palavra que realiza uma operação com um ou mais valores.",
    example: "total + frete",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["operadores"],
  },
  {
    id: "condicional",
    term: "Condicional",
    definition:
      "Estrutura que escolhe um caminho conforme uma condição verdadeira ou falsa.",
    example: "if (nota >= 7) { ... }",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["condicoes"],
    aliases: ["if", "decisão"],
  },
  {
    id: "loop",
    term: "Laço de repetição",
    definition: "Estrutura que repete um bloco enquanto uma regra permitir.",
    example: "for (let i = 0; i < 3; i++) { ... }",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["repeticoes"],
    aliases: ["loop", "for", "while"],
  },
  {
    id: "funcao",
    term: "Função",
    definition:
      "Bloco reutilizável que pode receber valores e devolver um resultado.",
    example: "function dobro(n) { return n * 2; }",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["funcoes"],
  },
  {
    id: "parametro",
    term: "Parâmetro",
    definition:
      "Nome declarado por uma função para representar um valor recebido.",
    example: "n é o parâmetro em dobro(n)",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["funcoes"],
  },
  {
    id: "retorno",
    term: "Retorno",
    definition: "Valor que uma função entrega a quem a chamou.",
    example: "return resultado;",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["funcoes"],
  },
  {
    id: "array",
    term: "Lista / Array",
    definition: "Coleção ordenada de valores acessados por posição.",
    example: "const notas = [8, 6, 10];",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["listas"],
    aliases: ["vetor", "lista"],
  },
  {
    id: "objeto",
    term: "Objeto",
    definition: "Estrutura que agrupa valores por nomes de propriedades.",
    example: "const aluno = { nome: 'Ana', nota: 9 };",
    languages: ["javascript", "python", "java", "cpp"],
    relatedExerciseIds: ["objetos"],
  },
  {
    id: "escopo",
    term: "Escopo",
    definition: "Região do programa em que um nome pode ser acessado.",
    example: "uma variável criada dentro da função pode ser local",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["funcoes"],
  },
  {
    id: "sintaxe",
    term: "Sintaxe",
    definition:
      "Regras de escrita que tornam um código legível pela linguagem.",
    example: "fechar parênteses e chaves corretamente",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["primeiros-passos"],
  },
  {
    id: "bug",
    term: "Bug",
    definition:
      "Defeito que faz o programa se comportar de modo diferente do esperado.",
    example: "usar > quando o limite deveria aceitar também o valor igual",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["debug-condicional"],
    aliases: ["erro", "falha"],
  },
  {
    id: "teste",
    term: "Teste automatizado",
    definition:
      "Verificação repetível que compara o resultado recebido com o esperado.",
    example: "dobro(3) deve resultar em 6",
    languages: ["javascript", "python", "java", "c", "cpp"],
    relatedExerciseIds: ["funcoes"],
  },
];

export function searchGlossary(query: string) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return GLOSSARY;
  return GLOSSARY.filter((entry) =>
    [entry.term, entry.definition, entry.example, ...(entry.aliases ?? [])]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(normalized),
  );
}
