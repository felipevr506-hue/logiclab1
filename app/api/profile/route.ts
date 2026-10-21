import { NextRequest, NextResponse } from "next/server";
import { requireRole, updateProfile } from "@/services/auth/auth-store";
import { isTrustedMutation, readJsonBody } from "@/services/security/request-guard";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  if (!isTrustedMutation(request))
    return NextResponse.json({ error: "Solicitação recusada." }, { status: 403 });
  const authenticated = await requireRole(request);
  if (!authenticated)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = await readJsonBody<{
    name?: string;
    goal?: string;
    dailyMinutes?: number;
    studyDaysPerWeek?: number;
    studyFocus?: string;
  }>(request, 8_000);
  if (!parsed.ok)
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const input = {
    name: parsed.value.name?.trim() ?? "",
    goal: parsed.value.goal?.trim() ?? "",
    dailyMinutes: Number(parsed.value.dailyMinutes),
    studyDaysPerWeek: Number(parsed.value.studyDaysPerWeek),
    studyFocus: parsed.value.studyFocus?.trim() ?? "",
  };
  if (
    input.name.length < 2 ||
    input.name.length > 80 ||
    input.goal.length < 2 ||
    input.goal.length > 120 ||
    ![15, 20, 30, 45].includes(input.dailyMinutes) ||
    !Number.isInteger(input.studyDaysPerWeek) ||
    input.studyDaysPerWeek < 1 ||
    input.studyDaysPerWeek > 7 ||
    input.studyFocus.length < 2 ||
    input.studyFocus.length > 120
  ) {
    return NextResponse.json({ error: "Revise os dados do perfil." }, { status: 400 });
  }
  const profile = authenticated.demo
    ? input
    : await updateProfile(authenticated.account.id, input);
  if (!profile)
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  return NextResponse.json(
    { profile },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
