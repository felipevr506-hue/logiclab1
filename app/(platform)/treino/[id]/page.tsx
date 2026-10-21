import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { exercises } from "@/lib/content";
import { TrainingAccess } from "@/components/training-access";
import { Paywall } from "@/components/paywall";
import { appConfig } from "@/lib/config";
import {
  authMode,
  getDevelopmentPrincipal,
  getSession,
  SESSION_COOKIE,
} from "@/services/auth/auth-store";

export function generateStaticParams() {
  return exercises.map(({ id }) => ({ id }));
}

export default async function TrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { id } = await params;
  const { modo } = await searchParams;
  const exercise = exercises.find((item) => item.id === id);
  if (!exercise) notFound();
  const cookieStore = await cookies();
  const authenticated = await getSession(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  let adminAuthorized = false;
  if (modo === "admin") {
    adminAuthorized = authenticated
      ? authenticated.account.role === "ADMIN"
      : authMode() === "demo" &&
        getDevelopmentPrincipal()?.account.role === "ADMIN";
  }
  const premiumExercise =
    exercises.findIndex((item) => item.id === exercise.id) >=
    appConfig.freeExerciseLimit;
  const premiumAuthorized =
    authMode() === "demo" ||
    authenticated?.account.plan === "PRO" ||
    authenticated?.account.role === "ADMIN";
  if (premiumExercise && !premiumAuthorized) return <Paywall />;
  return (
    <TrainingAccess
      exerciseId={exercise.id}
      adminAuthorized={adminAuthorized}
    />
  );
}
