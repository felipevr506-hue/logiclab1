"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Flame,
  Route,
  Trophy,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { formatDailyDate } from "@/lib/daily-workouts";
import { getLevelProgress } from "@/lib/gamification-config";
import { getDashboardView } from "@/lib/dashboard-view";
import { getAdaptiveRecommendation } from "@/services/gamification/mastery";
import styles from "./dashboard.module.css";

export function Dashboard() {
  const { state, demoMode, officialProgressAvailable } = useAppState();
  const view = getDashboardView(state);
  const { metrics, next, today } = view;
  const level = getLevelProgress(metrics.xp);
  const firstName = state.user.name.trim().split(/\s+/)[0];
  const todayComplete = state.completedExercises.includes(today.exerciseId);
  const hasSkillEvidence = Object.values(state.userSkills).some(
    (skill) => skill.attempts > 0,
  );
  const recommendation = hasSkillEvidence
    ? getAdaptiveRecommendation(state)
    : null;
  const officialAvailable = officialProgressAvailable || demoMode;

  return (
    <div className={styles.page}>
      <header className={styles.welcome}>
        <span>{formatDailyDate()}</span>
        <h1>{firstName ? `Olá, ${firstName}.` : "Olá!"}</h1>
        <p>
          {!officialAvailable
            ? "Carregue seu progresso para continuar."
            : view.hasProgress
              ? "Um passo de cada vez. Continue sua aprendizagem."
              : "Vamos começar? Sua primeira aula está aqui."}
        </p>
      </header>

      {!officialAvailable ? (
        <section
          className={styles.nextCard}
          aria-labelledby="unavailable-title"
        >
          <h2 id="unavailable-title">Seu progresso está indisponível agora</h2>
          <p>
            Reconecte-se para carregar seus dados oficiais. Seus rascunhos
            continuam preservados.
          </p>
          <button
            className="button button-secondary"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </section>
      ) : (
        <>
          <section className={styles.nextCard} aria-labelledby="next-title">
            <span className={styles.eyebrow}>
              <BookOpen size={16} aria-hidden="true" /> SEU PRÓXIMO PASSO
            </span>
            <h2 id="next-title">
              {next?.shortTitle ??
                (view.allCompleted
                  ? "Sua trilha está concluída"
                  : "Você concluiu as aulas liberadas")}
            </h2>
            <p>
              {next?.description ??
                (view.nextRelease
                  ? `A próxima aula será liberada em ${view.nextRelease.dateLabel}. Enquanto isso, você pode rever o que aprendeu.`
                  : "Continue praticando os conceitos que você aprendeu.")}
            </p>
            <div className={styles.nextActions}>
              <Link className="button button-primary" href={view.href}>
                {view.action}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              {next && (
                <span>Cerca de {next.duration} min · conceito e prática</span>
              )}
            </div>
            {!view.hasProgress && (
              <small>
                Nenhuma aula concluída ainda. Você começa do zero, no seu ritmo.
              </small>
            )}
          </section>

          <div className={styles.overview}>
            <section className={styles.card} aria-labelledby="path-title">
              <div className={styles.cardTitle}>
                <Route size={19} aria-hidden="true" />
                <h2 id="path-title">Minha trilha</h2>
              </div>
              <div className={styles.pathCount}>
                <strong>{metrics.progressPercent}%</strong>
                <span>
                  {metrics.completedCount} de {metrics.totalExercises}{" "}
                  exercícios concluídos
                </span>
              </div>
              <div
                className={styles.progress}
                role="progressbar"
                aria-label="Progresso da trilha"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={metrics.progressPercent}
              >
                <i style={{ width: `${metrics.progressPercent}%` }} />
              </div>
              <p>
                {metrics.completedCount
                  ? "Suas conclusões ficam salvas na sua conta."
                  : "O progresso aparece quando você concluir seus primeiros exercícios."}
              </p>
              <Link className={styles.textLink} href="/trilha">
                Ver minha trilha <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
            <section className={styles.card} aria-labelledby="today-title">
              <div className={styles.cardTitle}>
                <CalendarDays size={19} aria-hidden="true" />
                <h2 id="today-title">Treino do dia</h2>
              </div>
              <h3>{today.shortTitle}</h3>
              <p>
                {todayComplete
                  ? "Você já concluiu este exercício. Pode voltar a ele para praticar."
                  : "Uma sugestão para hoje. Você também pode seguir sua trilha."}
              </p>
              <Link
                className={styles.textLink}
                href={`/treino/${today.exerciseId}`}
              >
                {todayComplete ? "Rever treino" : "Ver treino de hoje"}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </div>

          <section
            className={styles.summary}
            aria-label="Seu progresso em números"
          >
            <div>
              <Flame size={19} aria-hidden="true" />
              <div>
                <b>
                  {metrics.streak}{" "}
                  {metrics.streak === 1 ? "dia seguido" : "dias seguidos"}
                </b>
                <p>
                  {state.activeDays.length
                    ? `${state.activeDays.length} ${state.activeDays.length === 1 ? "dia de prática registrado" : "dias de prática registrados"}`
                    : "Nenhuma atividade registrada ainda."}
                </p>
              </div>
            </div>
            <div>
              <Trophy size={19} aria-hidden="true" />
              <div>
                <b>
                  Nível {level.level} ·{" "}
                  <span data-testid="dashboard-xp">{metrics.xp} XP</span>
                </b>
                <p>
                  {level.nextThreshold - metrics.xp} XP para o próximo nível
                </p>
              </div>
            </div>
            <Link className={styles.textLink} href="/evolucao">
              Meu progresso <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>

          {recommendation && (
            <aside
              className={styles.recommendation}
              aria-label="Recomendação baseada na sua prática"
            >
              <div>
                <span className={styles.eyebrow}>
                  PARA A SUA PRÓXIMA PRÁTICA
                </span>
                <h2>{recommendation.title}</h2>
                <p>{recommendation.reason}</p>
              </div>
              <Link className={styles.textLink} href="/praticar">
                Ver práticas <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </aside>
          )}
        </>
      )}
    </div>
  );
}
