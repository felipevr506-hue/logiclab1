import type { Exercise } from "@/lib/types";
import { assessSubmission } from "@/services/attempts/static-assessment";

export const CHAT_POLICY_VERSION = "2026-10-17.socratic-v2";
export const PARTIAL_GUIDANCE =
  "Vamos construir seu raciocínio sem entregar código pronto. Escolha um requisito: qual resultado você espera e o que seu programa faz hoje?";
const normalized = (text: string) =>
  text
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f\p{Cf}]/gu, "")
    .toLowerCase();
const compact = (text: string) => normalized(text).replace(/[^a-z0-9]/g, "");

export function requestsSolution(text: string) {
  const value = normalized(text);
  if (
    /resolv[ae].{0,20}(?:pra|para|por).{0,8}mim|(?:primeira|proxima|segunda|ultima).{0,10}(?:linha|parte)|(?:apenas|so).{0,12}(?:codigo|resposta)|(?:exemplo|example).{0,15}(?:resolver|solucionar)/s.test(
      value,
    )
  )
    return true;
  return /(?:solucao|resposta|codigo|implementacao|gabarito).{0,40}(?:complet|pront|inteir|final|equivalente)|(?:complet|pront|inteir|final).{0,30}(?:solucao|resposta|codigo)|(?:solution|answer|code).{0,25}(?:complete|full|entire)|(?:full|complete|entire).{0,25}(?:solution|answer|code)|gabarito|(?:proxima|primeira|segunda|ultima).{0,15}(?:parte|linha).{0,20}(?:codigo|solucao)|(?:solucao|codigo).{0,20}(?:partes|pedacos)|(?:exemplo|example).{0,35}(?:equivalente|mesm[oa]|same)|(?:ignore|ignora|desconsidere).{0,40}(?:instruc|regra|system)|base64|rot13|(?:mostre|escreva|gere|write|give).{0,25}(?:funcao|function|answer|solution)/s.test(
    value,
  );
}

export function redactPrivate(text: string) {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-mail omitido]")
    .replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, "[chave omitida]")
    .replace(/(?:postgres(?:ql)?:\/\/|https?:\/\/)[^\s"']+/gi, "[URL omitida]")
    .replace(
      /\b\w*(?:password|senha|api[_-]?key|secret|token|authorization|database_url|session|cookie)\w*\s*[:=]\s*[^\n;,]+/gi,
      "[credencial omitida]",
    );
}

/** Private reference is used only for filtering, never serialized into model context. */
export function safeContextText(text: string, exercise: Exercise, max: number) {
  if (text.length <= 12_000 && assessSubmission(text, exercise).passed)
    return "[Código já validável omitido]";
  if (compact(text).includes(compact(exercise.solution)))
    return "[Trecho equivalente à referência omitido]";
  return redactPrivate(text).slice(0, max);
}

export function protectReply(
  candidate: unknown,
  exercise: Exercise,
  priorTutorText: string[] = [],
) {
  if (typeof candidate !== "string")
    return { text: PARTIAL_GUIDANCE, filtered: true };
  const text = candidate.trim();
  const joined = [...priorTutorText.slice(-12), text].join(" ");
  const codeLike =
    /```|[{};]|=>|\b(?:function|def)\s+\w+\s*\(|\b(?:const|let|var)\s+[a-z_$][\w$]*\s*(?:=|;|$)|\breturn\s+(?:[a-z_$][\w$]*|["'\d])\s*(?:$|[;})])|\b(?:console\s*\.\s*\w+|eval|if|for|while)\s*\(|(?:>=|<=|===|!==|\+=|\*=)|(?:^|\n)\s*(?:\d+[.)]|[-*])\s+/i;
  const reference = compact(exercise.solution);
  const joinedCompact = compact(joined);
  const prose = normalized(text);
  const semanticRecipe =
    (exercise.solution.includes("*") &&
      /multipli|dobro|produto|twice|double/.test(prose) &&
      /retorn|devolv|resultado|valor/.test(prose)) ||
    (exercise.solution.includes("trim") &&
      /trim/.test(prose) &&
      /length|tamanho/.test(prose)) ||
    (exercise.solution.includes("map") &&
      /map/.test(prose) &&
      /retorn|devolv/.test(prose));
  // Reject full reference, executable-looking fragments and multi-step recipes.
  const recipe = /(?:primeiro|depois|em seguida|por fim|first|then|finally)/gi;
  const overlap =
    reference.length > 30 &&
    Array.from({ length: Math.max(0, reference.length - 29) }, (_, i) =>
      reference.slice(i, i + 30),
    ).some((part) => joinedCompact.includes(part));
  const filtered =
    !text ||
    text.length > 700 ||
    codeLike.test(normalized(text)) ||
    semanticRecipe ||
    assessSubmission(text, exercise).passed ||
    /\\[ux][a-f0-9]{2,}|&#|[a-z0-9+/]{50,}={0,2}|\b\w+\s*[*+/%]\s*\w+/i.test(
      text,
    ) ||
    /https?:|sk-|<[^>]+>/i.test(text) ||
    requestsSolution(text) ||
    joinedCompact.includes(reference) ||
    overlap ||
    (text.match(recipe)?.length ?? 0) >= 2;
  return { text: filtered ? PARTIAL_GUIDANCE : redactPrivate(text), filtered };
}
