"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { TrainingWorkspace } from "@/components/training-workspace";
import {
  addDaysToDateKey,
  getUserDailyWorkout,
  getUserTrainingStartDate,
  getWorkoutForExercise,
  isUserWorkoutUnlocked,
} from "@/lib/daily-workouts";
import { useAppState } from "@/lib/app-state";

const ADMIN_PREVIEW_KEY = "logiclab-admin-workout-preview";
const LEARNING_ACCESS_KEY = "logiclab-learning-exercise-access";

export function TrainingAccess({
  exerciseId,
  adminAuthorized = false,
}: {
  exerciseId: string;
  adminAuthorized?: boolean;
}) {
  const searchParams = useSearchParams();
  const { state } = useAppState();
  const requestedWorkout = getWorkoutForExercise(exerciseId);
  const currentWorkout = getUserDailyWorkout(state.user.trainingStartedOn);
  const previewRequested = searchParams.get("modo") === "admin";
  const learningMode = searchParams.get("modo");
  const learningAccessRequested =
    learningMode === "pratica" ||
    learningMode === "projeto" ||
    learningMode === "prova";
  const accessNeedsCheck = previewRequested || learningAccessRequested;
  const [previewChecked, setPreviewChecked] = useState(!accessNeedsCheck);
  const [adminPreview, setAdminPreview] = useState(false);
  const [learningAccess, setLearningAccess] = useState<{
    mode: "practice" | "project" | "assessment";
    sourceId?: string;
  } | null>(null);

  useEffect(() => {
    if (!accessNeedsCheck || !requestedWorkout) return;
    const timer = window.setTimeout(() => {
      if (previewRequested) {
        const selectedWorkout =
          window.sessionStorage.getItem(ADMIN_PREVIEW_KEY);
        setAdminPreview(
          adminAuthorized && selectedWorkout === requestedWorkout.id,
        );
      } else {
        try {
          const stored = JSON.parse(
            window.sessionStorage.getItem(LEARNING_ACCESS_KEY) ?? "{}",
          ) as {
            exerciseId?: string;
            mode?: "practice" | "project" | "assessment";
            sourceId?: string;
          };
          if (
            stored.exerciseId === exerciseId &&
            ((learningMode === "pratica" && stored.mode === "practice") ||
              (learningMode === "projeto" && stored.mode === "project") ||
              (learningMode === "prova" && stored.mode === "assessment"))
          ) {
            setLearningAccess({ mode: stored.mode, sourceId: stored.sourceId });
          }
        } catch {
          setLearningAccess(null);
        }
      }
      setPreviewChecked(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    accessNeedsCheck,
    adminAuthorized,
    exerciseId,
    learningMode,
    previewRequested,
    requestedWorkout,
  ]);

  if (!requestedWorkout) return null;

  if (!previewChecked) {
    return (
      <main className="route-state workout-access-state">
        <CalendarClock />
        <h1>Validando visualização administrativa…</h1>
      </main>
    );
  }

  const availableToStudent = isUserWorkoutUnlocked(
    requestedWorkout,
    state.user.trainingStartedOn,
  );
  if (!availableToStudent && !adminPreview && !learningAccess) {
    return (
      <main className="route-state workout-access-state workout-locked-state">
        <span>
          <LockKeyhole />
        </span>
        <small>PROGRAMAÇÃO DIÁRIA · TREINO {requestedWorkout.day}</small>
        <h1>Este treino está bloqueado para o aluno.</h1>
        <p>
          Um novo treino é liberado por dia no horário de Brasília. Este ficará
          disponível em{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
          }).format(
            new Date(
              `${addDaysToDateKey(getUserTrainingStartDate(state.user.trainingStartedOn), requestedWorkout.day - 1)}T12:00:00Z`,
            ),
          )}
          .
        </p>
        <div>
          <Link
            className="button button-primary"
            href={"/treino/" + currentWorkout.exerciseId}
          >
            Ir para o treino de hoje
          </Link>
          <Link className="button button-secondary" href="/dashboard">
            <ArrowLeft /> Voltar ao dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      {adminPreview && (
        <div className="admin-preview-banner" role="status">
          <ShieldCheck /> Visualização administrativa · Treino{" "}
          {requestedWorkout.day}
          <Link href="/admin">Voltar ao painel</Link>
        </div>
      )}
      {learningAccess && (
        <div
          className="admin-preview-banner learning-mode-banner"
          role="status"
        >
          <ShieldCheck />
          {learningAccess.mode === "project"
            ? "Etapa de projeto · progresso separado da trilha"
            : learningAccess.mode === "assessment"
              ? "Modo prova · dicas e tutor pausados"
              : "Prática livre · progresso separado da trilha"}
          <Link
            href={
              learningAccess.mode === "project"
                ? `/projetos${learningAccess.sourceId ? `#${learningAccess.sourceId}` : ""}`
                : learningAccess.mode === "assessment"
                  ? "/prova"
                  : "/praticar"
            }
          >
            Voltar
          </Link>
        </div>
      )}
      <TrainingWorkspace
        initialExerciseId={exerciseId}
        workout={requestedWorkout}
        adminPreview={adminPreview}
        startInPractice={searchParams.get("etapa") === "pratica"}
        activityMode={learningAccess?.mode ?? "path"}
        projectId={
          learningAccess?.mode === "project"
            ? learningAccess.sourceId
            : undefined
        }
        assessmentId={
          learningAccess?.mode === "assessment"
            ? learningAccess.sourceId
            : undefined
        }
      />
    </>
  );
}

export function enableAdminWorkoutPreview(workoutId: string) {
  window.sessionStorage.setItem(ADMIN_PREVIEW_KEY, workoutId);
}

export function enableLearningExerciseAccess(
  exerciseId: string,
  mode: "practice" | "project" | "assessment",
  sourceId?: string,
) {
  window.sessionStorage.setItem(
    LEARNING_ACCESS_KEY,
    JSON.stringify({ exerciseId, mode, sourceId }),
  );
}
