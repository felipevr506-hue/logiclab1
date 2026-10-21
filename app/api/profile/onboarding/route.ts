import { NextRequest, NextResponse } from "next/server";
import { requireRole, updateOnboarding } from "@/services/auth/auth-store";
import { recordProductEvent } from "@/services/analytics/product-events";
import { isTrustedMutation, readJsonBody } from "@/services/security/request-guard";

export const runtime = "nodejs";

const experiences = new Set(["Nunca", "Um pouco", "Já fiz cursos"]);
const goals = new Set([
  "Aprender programação",
  "Melhorar minha lógica",
  "Resolver exercícios sozinho",
  "Faculdade",
]);
const locales = new Set(["pt-BR", "en"]);
const languages = new Set(["javascript"]);

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json({ error: "Solicitação recusada." }, { status: 403 });
  const authenticated = await requireRole(request);
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = await readJsonBody<{
    experience?: string;
    goal?: string;
    dailyMinutes?: number;
    locale?: string;
    initialLanguage?: string;
  }>(request, 4_000);
  if (!parsed.ok)
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const input = {
    experience: parsed.value.experience ?? "",
    goal: parsed.value.goal ?? "",
    dailyMinutes: Number(parsed.value.dailyMinutes),
    locale: parsed.value.locale ?? "pt-BR",
    initialLanguage: parsed.value.initialLanguage ?? "javascript",
  };
  if (
    !experiences.has(input.experience) ||
    !goals.has(input.goal) ||
    ![15, 20, 30, 45].includes(input.dailyMinutes) ||
    !locales.has(input.locale) ||
    !languages.has(input.initialLanguage)
  ) {
    return NextResponse.json(
      { error: "Revise as respostas do onboarding." },
      { status: 400 },
    );
  }
  const profile = authenticated.demo
    ? { ...input, onboardingCompleted: true }
    : await updateOnboarding(authenticated.account.id, input);
  if (!profile)
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  await recordProductEvent({
    userId: authenticated.account.id,
    name: "onboarding_completed",
    sessionId: authenticated.session.id,
    properties: { locale: input.locale, initialLanguage: input.initialLanguage },
  });
  return NextResponse.json(
    { profile },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
