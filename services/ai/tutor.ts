import type { ExerciseTest, ProgrammingLanguageId } from "@/lib/types";
import type { ExecutionError, TestResult } from "@/services/code-runner/types";

export type TutorIntent =
  | "hint"
  | "explain-error"
  | "analyze-logic"
  | "confused"
  | "request-solution"
  | "question";

export type TutorContext = {
  exerciseId: string;
  title: string;
  description: string;
  concept: string;
  language: ProgrammingLanguageId;
  skillMastery: number;
  recentHistory: Array<{
    passed: boolean;
    passedTests: number;
    failedTests: number;
    hintsUsed: number;
  }>;
  studentCode: string;
  expectedBehavior: string;
  tests: ExerciseTest[];
  testResults: TestResult[];
  runtimeError?: ExecutionError;
  attemptNumber: number;
  hintsUsed: number;
  progressiveHints: string[];
  previousTutorMessages?: string[];
  solution: string;
  intent: TutorIntent;
  question?: string;
};

export type TutorReply = {
  message: string;
  helpLevel: 1 | 2 | 3 | 4 | 5;
  errorKind?: "syntax" | "logic" | "runtime" | "output";
};

export interface TutorService {
  guide(context: TutorContext): Promise<TutorReply>;
}

export const TUTOR_PROMPT_VERSION = "2026-08-21.v1";

export const tutorSystemPrompt = `Você é um tutor de lógica de programação para iniciantes.
Ajude com perguntas e pistas progressivas. Nunca forneça a solução completa,
mesmo depois de várias tentativas ou a pedido do aluno.
Use linguagem simples, explique uma ideia por vez e diferencie erros de sintaxe,
lógica, execução e saída incorreta. Considere sempre a linguagem, os testes, o histórico recente e o domínio da habilidade.`;

function errorKind(context: TutorContext): TutorReply["errorKind"] {
  const executionError =
    context.runtimeError ??
    context.testResults.find((test) => test.error)?.error;
  if (executionError?.kind === "syntax") return "syntax";
  if (executionError) return "runtime";
  if (
    context.testResults.some(
      (test) => !test.passed && Boolean(test.expectedLogs),
    )
  )
    return "output";
  if (context.testResults.some((test) => !test.passed)) return "logic";
  return undefined;
}

function helpLevel(context: TutorContext): 1 | 2 | 3 | 4 {
  if (context.attemptNumber >= 4 || context.hintsUsed >= 3) return 4;
  if (context.attemptNumber >= 3 || context.hintsUsed >= 2) return 3;
  if (context.attemptNumber >= 2 || context.hintsUsed >= 1) return 2;
  return 1;
}

function failedTestMessage(context: TutorContext) {
  const failed = context.testResults.find((test) => !test.passed);
  if (!failed) return "Ainda não há um teste com falha para analisar.";
  const received =
    typeof failed.received === "undefined"
      ? "nenhum valor"
      : JSON.stringify(failed.received);
  return `No cenário “${failed.label}”, o programa produziu ${received}. ${failed.feedback}`;
}

/**
 * Tutor local do modo de demonstração. Ele usa o mesmo contrato estruturado
 * previsto para um provedor de IA no servidor, mas funciona sem chave e alterna
 * a formulação das respostas sem alterar a orientação pedagógica.
 */
export class SocraticFallbackTutor implements TutorService {
  private responseCounters = new Map<string, number>();

  private variedMessage(
    context: TutorContext,
    category: string,
    variants: string[],
  ) {
    const key = `${context.exerciseId}:${context.intent}:${category}`;
    const previousMessages = new Set(context.previousTutorMessages ?? []);
    let count = this.responseCounters.get(key) ?? 0;

    // Procura uma formulação que ainda não apareceu na conversa. Isso preserva
    // a variação mesmo depois de recarregar a página, quando o contador local é
    // reiniciado, mas o histórico do aluno continua salvo.
    for (
      let attempt = 0;
      attempt <= previousMessages.size + variants.length;
      attempt += 1
    ) {
      const message = variants[count % variants.length];
      const cycle = Math.floor(count / variants.length);
      const candidate =
        cycle === 0
          ? message
          : `${message}\n\nRetomada ${cycle + 1}: releia esta orientação aplicando-a ao estado atual do seu código.`;
      count += 1;
      if (!previousMessages.has(candidate)) {
        this.responseCounters.set(key, count);
        return candidate;
      }
    }

    // O laço sempre encontra uma retomada inédita; este retorno mantém o tipo
    // total caso um histórico externo extremamente grande seja importado.
    this.responseCounters.set(key, count + 1);
    return `${variants[count % variants.length]}\n\nNova análise ${count + 1}: aplique esta orientação ao código que está no editor agora.`;
  }

  async guide(context: TutorContext): Promise<TutorReply> {
    const kind = errorKind(context);
    const level = helpLevel(context);
    const executionError =
      context.runtimeError ??
      context.testResults.find((test) => test.error)?.error;

    if (context.intent === "request-solution") {
      return {
        helpLevel: level,
        errorKind: kind,
        message:
          "Vamos construir sua resposta com pistas, sem entregar código pronto. Qual requisito ainda não foi atendido pelo seu programa?",
      };
    }

    if (kind === "syntax" && executionError) {
      return {
        helpLevel: level,
        errorKind: kind,
        message: this.variedMessage(context, "syntax", [
          `Este é um erro de sintaxe: o JavaScript não conseguiu ler o código. A mensagem foi “${executionError.message}”${executionError.line ? `, perto da linha ${executionError.line}` : ""}. Confira primeiro pares de chaves, parênteses e aspas. Qual deles ficou sem o par correspondente?`,
          `O problema é de sintaxe, ou seja, o JavaScript parou antes de executar. Ele informou “${executionError.message}”${executionError.line ? ` próximo da linha ${executionError.line}` : ""}. Revise chaves, parênteses e aspas em pares: algum foi aberto e não fechado?`,
          `A leitura do código falhou com “${executionError.message}”${executionError.line ? ` na região da linha ${executionError.line}` : ""}. Isso caracteriza erro de sintaxe. Procure primeiro um delimitador sem par entre chaves, parênteses e aspas.`,
          `Ainda não chegamos à lógica porque há um erro de sintaxe: “${executionError.message}”${executionError.line ? `, por volta da linha ${executionError.line}` : ""}. Conte as aberturas e fechamentos de (), {} e aspas; qual par está incompleto?`,
        ]),
      };
    }

    if (kind === "runtime" && executionError) {
      return {
        helpLevel: level,
        errorKind: kind,
        message: this.variedMessage(context, "runtime", [
          `A escrita foi aceita, mas algo falhou durante a execução: “${executionError.message}”. Observe o valor usado imediatamente antes da falha. Ele tem o tipo e o conteúdo que você esperava?`,
          `O código pôde ser lido, porém a execução parou com “${executionError.message}”. Inspecione o dado usado logo antes desse ponto: o valor e o tipo são os previstos?`,
          `Este é um erro de execução, não de escrita: “${executionError.message}”. Siga o valor que chega à operação que falhou e confira se ele existe e tem o formato esperado.`,
          `A falha aconteceu enquanto o programa rodava: “${executionError.message}”. Volte uma linha e verifique qual valor foi produzido antes de ser usado; ele é válido para essa operação?`,
        ]),
      };
    }

    if (context.intent === "question" && context.question) {
      return {
        helpLevel: level,
        errorKind: kind,
        message: this.variedMessage(context, "question", [
          `Sobre “${context.question}”: use o comportamento esperado como referência — ${context.expectedBehavior}. Qual parte do seu código é responsável exatamente por esse resultado?`,
          `Para responder “${context.question}”, compare seu código com esta regra: ${context.expectedBehavior} Em qual linha você implementou esse comportamento?`,
          `A referência para sua dúvida “${context.question}” é: ${context.expectedBehavior} Agora localize a decisão ou transformação que deveria produzir esse resultado.`,
          `Vamos ligar sua pergunta ao objetivo do exercício. O resultado esperado é: ${context.expectedBehavior} Que trecho da sua solução garante isso — ou ainda precisa garantir?`,
        ]),
      };
    }

    if (
      context.concept.toLowerCase().includes("condi") &&
      /nota\s*>\s*7/.test(context.studentCode)
    ) {
      return {
        helpLevel: Math.max(2, level) as 2 | 3 | 4,
        errorKind: "logic",
        message: this.variedMessage(context, "condition-boundary", [
          "Sua estrutura de decisão está no caminho certo. Repare no limite: se a regra diz que a nota 7 também aprova, qual operador inclui o próprio 7?",
          "A decisão está bem montada, mas o valor de fronteira merece atenção. Se 7 precisa ser aprovado, a comparação deve aceitar igualdade. Que operador faz isso?",
          "O ponto a corrigir é o limite da condição: `> 7` exclui exatamente a nota 7. Como escrever a comparação para incluir esse valor?",
          "Teste mentalmente com nota igual a 7. A condição atual dá falso, embora a regra peça aprovação. Qual símbolo acrescenta o caso de igualdade?",
        ]),
      };
    }

    if (
      context.intent === "explain-error" &&
      context.testResults.length > 0 &&
      context.testResults.every((test) => test.passed)
    ) {
      return {
        helpLevel: level,
        message: this.variedMessage(context, "all-passed", [
          `Todos os cenários passaram. Sua solução atende ao comportamento esperado: ${context.expectedBehavior} Para consolidar, tente explicar com suas palavras qual parte do código garante o caso-limite.`,
          `Os testes confirmam sua solução em todos os cenários. Ela cumpre: ${context.expectedBehavior} Agora identifique o trecho que protege o valor de fronteira.`,
          `Não há falhas nos testes: o comportamento exigido foi atendido — ${context.expectedBehavior} Para fixar a ideia, explique por que o caso-limite também funciona.`,
          `Sua resposta passou por toda a validação e produz: ${context.expectedBehavior} Qual decisão do código foi essencial para cobrir também os extremos?`,
        ]),
      };
    }

    if (context.intent === "explain-error" && kind) {
      return {
        helpLevel: level,
        errorKind: kind,
        message: this.variedMessage(context, "failed-test", [
          `${failedTestMessage(context)} Isso indica um erro de ${kind === "output" ? "saída" : "lógica"}, não de escrita. Percorra mentalmente esse caso e localize a primeira linha em que o resultado se afasta do esperado.`,
          `${failedTestMessage(context)} O programa executou, então investigue a ${kind === "output" ? "saída produzida" : "decisão lógica"}. Em que primeira etapa desse cenário o valor deixa de ser o esperado?`,
          `${failedTestMessage(context)} A sintaxe está válida; a divergência está na ${kind === "output" ? "forma de entregar a saída" : "regra aplicada"}. Simule esse caso linha a linha até achar a primeira diferença.`,
          `${failedTestMessage(context)} Como a execução chegou ao teste, concentre-se no erro de ${kind === "output" ? "saída" : "lógica"}. Qual condição ou retorno determina esse resultado incorreto?`,
        ]),
      };
    }

    if (context.intent === "analyze-logic") {
      if (!context.studentCode.trim()) {
        return {
          helpLevel: 1,
          message: this.variedMessage(context, "empty-editor", [
            "O editor ainda está vazio. Comece escrevendo somente a assinatura da função ou a primeira variável pedida no enunciado.",
            "Ainda não há código para analisar. Dê o primeiro passo com a assinatura da função ou com a variável inicial solicitada.",
            "Vamos criar uma base antes da análise: escreva apenas a função pedida, ou a primeira variável do enunciado, sem tentar resolver tudo de uma vez.",
            "O painel está vazio no momento. Comece pela menor estrutura válida — a assinatura da função ou a entrada inicial — e execute novamente.",
          ]),
        };
      }
      return {
        helpLevel: level,
        errorKind: kind,
        message: kind
          ? this.variedMessage(context, "logic-with-failure", [
              `${failedTestMessage(context)} Sua ideia principal existe; agora teste o caminho desse caso linha por linha. Qual condição decide esse resultado?`,
              `${failedTestMessage(context)} Há uma estrutura aproveitável no seu código. Simule justamente esse cenário e descubra qual decisão escolhe o caminho incorreto.`,
              `${failedTestMessage(context)} A base da solução está presente; falta ajustar o fluxo deste caso. Qual expressão controla o resultado que ele recebe?`,
              `${failedTestMessage(context)} Siga as variáveis desse cenário da entrada ao retorno. Em qual condição elas deixam de seguir o comportamento esperado?`,
            ])
          : this.variedMessage(context, "logic-ready", [
              `Sua solução já tem uma base para ${context.concept.toLowerCase()}. Envie a resposta para eu comparar a lógica com todos os cenários, inclusive os limites.`,
              `A estrutura de ${context.concept.toLowerCase()} já aparece no código. Use “Enviar resposta” para validarmos os casos comuns e os valores de fronteira.`,
              `Seu raciocínio já está representado no editor. O próximo passo é enviar a resposta e confrontá-la com todos os cenários, especialmente os limites.`,
              `Vejo uma base coerente para ${context.concept.toLowerCase()}. Execute a correção completa para sabermos como ela se comporta nas entradas normais e extremas.`,
            ]),
      };
    }

    if (context.intent === "confused") {
      return {
        helpLevel: Math.max(3, level) as 3 | 4,
        errorKind: kind,
        message: this.variedMessage(context, "confused", [
          `Vamos reduzir o problema. O objetivo é: ${context.description} Esqueça o código por um instante: qual seria o primeiro passo se você resolvesse um exemplo no papel?`,
          `Vamos separar o exercício em partes. Você precisa: ${context.description} Antes de programar, pegue um exemplo simples e diga qual operação faria primeiro.`,
          `Pause o código e volte ao raciocínio básico: ${context.description} Se alguém lhe desse uma entrada no papel, qual seria sua primeira decisão?`,
          `Podemos tornar isso menor. A meta é: ${context.description} Resolva oralmente um único exemplo e identifique só o primeiro passo; depois nós o transformamos em código.`,
        ]),
      };
    }

    const hintIndex = Math.min(
      Math.max(0, level - 1),
      context.progressiveHints.length - 1,
    );
    const hint = context.progressiveHints[hintIndex];
    return {
      helpLevel: level,
      errorKind: kind,
      message:
        level === 4
          ? this.variedMessage(context, "structured-hint", [
              `${hint} Monte primeiro a estrutura em etapas: entrada, decisão ou transformação, e retorno. Complete uma etapa por vez e execute entre elas.`,
              `${hint} Organize a solução em três momentos — entrada, decisão ou transformação e retorno. Implemente e execute uma parte de cada vez.`,
              `${hint} Divida o trabalho: receba os dados, aplique a regra e devolva o resultado. Valide cada bloco antes de avançar ao seguinte.`,
              `${hint} Esboce primeiro o fluxo completo com entrada, processamento e retorno. Depois preencha cada etapa separadamente, testando entre elas.`,
            ])
          : this.variedMessage(context, "progressive-hint", [
              `${hint} Que pequena alteração você pode testar agora para confirmar essa ideia?`,
              `${hint} Aplique apenas esse ajuste e execute de novo: qual resultado você espera observar?`,
              `${hint} Transforme essa pista na menor mudança possível do código e confira um cenário por vez.`,
              `${hint} Antes de mudar várias linhas, escolha um único teste que confirme essa ideia e faça o ajuste correspondente.`,
            ]),
    };
  }
}

export const tutorService: TutorService = new SocraticFallbackTutor();
