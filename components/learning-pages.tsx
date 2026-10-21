"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bug,
  CheckCircle2,
  Clock3,
  Code2,
  Flag,
  FolderKanban,
  Gift,
  Languages,
  LockKeyhole,
  Target,
  Trophy,
  ClipboardCheck,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { exercises } from "@/lib/content";
import { LANGUAGE_CATALOG, SKILL_CATALOG } from "@/lib/gamification-config";
import { PROJECT_CATALOG } from "@/lib/learning-program";
import { ProgressBar } from "@/components/ui";
import { enableLearningExerciseAccess } from "@/components/training-access";
import {
  getProjectProgress,
  getWeeklyMissionProgress,
  getWeeklyReport,
} from "@/services/learning/learning-program";

const skillNames = Object.fromEntries(
  SKILL_CATALOG.map((skill) => [skill.id, skill.title]),
);

export function PracticePage() {
  const router = useRouter();
  const { state } = useAppState();
  const [concept, setConcept] = useState("todos");
  const [difficulty, setDifficulty] = useState("todas");
  const [language, setLanguage] = useState(state.primaryLanguage);
  const concepts = [...new Set(exercises.map((exercise) => exercise.concept))];
  const unlockedLanguages = LANGUAGE_CATALOG.filter((candidate) =>
    state.userLanguages.some(
      (unlocked) => unlocked.languageId === candidate.id,
    ),
  );
  const results = useMemo(
    () =>
      exercises.filter(
        (exercise) =>
          (exercise.language ?? "javascript") === language &&
          (concept === "todos" || exercise.concept === concept) &&
          (difficulty === "todas" || exercise.difficulty === difficulty),
      ),
    [concept, difficulty, language],
  );

  const start = (exerciseId: string) => {
    enableLearningExerciseAccess(exerciseId, "practice");
    router.push(`/treino/${exerciseId}?modo=pratica&etapa=pratica`);
  };

  return (
    <div className="standard-page learning-program-page practice-page">
      <LearningIntro
        icon={Target}
        eyebrow="PRÁTICA LIVRE"
        title="Escolha exatamente o que treinar."
        text="As tentativas atualizam seu domínio, mas não avançam a trilha obrigatória. Uma revisão válida rende XP apenas uma vez por semana e exercício."
      />
      <section className="practice-filters panel-card">
        <label>
          Assunto
          <select
            value={concept}
            onChange={(event) => setConcept(event.target.value)}
          >
            <option value="todos">Todos os assuntos</option>
            {concepts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Dificuldade
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="todas">Todas</option>
            <option>Fácil</option>
            <option>Médio</option>
            <option>Desafio</option>
          </select>
        </label>
        <label>
          Linguagem
          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as typeof language)
            }
          >
            {unlockedLanguages.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {language !== "javascript" ? (
        <section className="external-runner-note panel-card">
          <Languages />
          <div>
            <h2>Executor externo necessário</h2>
            <p>
              {LANGUAGE_CATALOG.find((item) => item.id === language)?.name} está
              desbloqueada, mas a execução não será simulada no navegador.
              Conecte um sandbox isolado para liberar exercícios reais.
            </p>
          </div>
        </section>
      ) : (
        <section className="practice-results">
          {results.map((exercise) => (
            <article
              className="practice-exercise-card panel-card"
              key={exercise.id}
            >
              <span>
                {exercise.exerciseType === "debugging" ? <Bug /> : <Code2 />}
              </span>
              <div>
                <small>
                  {exercise.concept} · {exercise.difficulty}
                </small>
                <h2>{exercise.title}</h2>
                <p>{exercise.objective}</p>
                <div>
                  <span>
                    <Clock3 /> {exercise.minutes} min
                  </span>
                  {exercise.exerciseType === "debugging" && (
                    <span>
                      <Bug /> Corrija o código
                    </span>
                  )}
                </div>
              </div>
              <button
                className="button button-primary"
                onClick={() => start(exercise.id)}
              >
                Praticar <ArrowRight />
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export function MissionsPage() {
  const { state, claimWeeklyMission } = useAppState();
  const mission = getWeeklyMissionProgress(state);
  if (!state.featureFlags.WEEKLY_MISSIONS) {
    return (
      <section className="route-state">
        <span>
          <Flag />
        </span>
        <h1>Missões temporariamente desativadas</h1>
        <p>A administração pausou este recurso.</p>
      </section>
    );
  }
  return (
    <div className="standard-page learning-program-page">
      <LearningIntro
        icon={Flag}
        eyebrow="MISSÕES"
        title="Uma meta semanal sem recompensa aleatória."
        text="O progresso é calculado pelas transações e conclusões reais da semana de Brasília. A recompensa tem chave única e não pode ser resgatada novamente."
      />
      <section className="mission-card panel-card">
        <header>
          <span>
            <Flag />
          </span>
          <div>
            <small>
              {mission.week.start} a {mission.week.end}
            </small>
            <h2>{mission.title}</h2>
            <p>{mission.description}</p>
          </div>
          <b>
            {mission.completedObjectives} / {mission.objectives.length}{" "}
            objetivos
          </b>
        </header>
        <ProgressBar
          value={
            (mission.completedObjectives / mission.objectives.length) * 100
          }
        />
        <div className="mission-objectives">
          {mission.objectives.map((objective) => (
            <div
              className={objective.complete ? "complete" : ""}
              key={objective.id}
            >
              {objective.complete ? <CheckCircle2 /> : <Target />}
              <span>
                <b>{objective.label}</b>
                <small>
                  {objective.current} / {objective.target}
                </small>
              </span>
            </div>
          ))}
        </div>
        <footer>
          <span>
            <Gift /> Recompensa: +{mission.xpReward} XP
          </span>
          <button
            className="button button-primary"
            disabled={!mission.complete || mission.claimed}
            onClick={claimWeeklyMission}
          >
            {mission.claimed ? "Recompensa resgatada" : "Resgatar recompensa"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function ProjectsPage() {
  const router = useRouter();
  const { state, claimProject } = useAppState();
  const startStep = (exerciseId: string, projectId: string) => {
    enableLearningExerciseAccess(exerciseId, "project", projectId);
    router.push(`/treino/${exerciseId}?modo=projeto&etapa=pratica`);
  };
  return (
    <div className="standard-page learning-program-page">
      <LearningIntro
        icon={FolderKanban}
        eyebrow="PROJETOS"
        title="Construa em etapas verificáveis."
        text="Cada etapa usa o editor e os testes reais. Tentativas de projeto ficam separadas da trilha e a recompensa só é liberada quando todas passam."
      />
      <section className="project-grid">
        {PROJECT_CATALOG.map((definition) => {
          const project = getProjectProgress(state, definition.id);
          return (
            <article
              className={`project-card panel-card ${project.unlocked ? "" : "locked"}`}
              id={project.id}
              key={project.id}
            >
              <header>
                <span>
                  {project.unlocked ? <FolderKanban /> : <LockKeyhole />}
                </span>
                <div>
                  <small>JAVASCRIPT · NÍVEL {project.requiredLevel}</small>
                  <h2>{project.title}</h2>
                  <p>{project.description}</p>
                </div>
                <b>
                  {project.completedSteps}/{project.steps.length}
                </b>
              </header>
              <ProgressBar
                value={(project.completedSteps / project.steps.length) * 100}
              />
              <div className="project-steps">
                {project.steps.map((step, index) => (
                  <div
                    className={step.complete ? "complete" : ""}
                    key={step.id}
                  >
                    <span>{step.complete ? <CheckCircle2 /> : index + 1}</span>
                    <div>
                      <small>ETAPA {index + 1}</small>
                      <b>{step.title}</b>
                    </div>
                    <button
                      className="button button-secondary"
                      disabled={!project.unlocked}
                      onClick={() => startStep(step.exerciseId, project.id)}
                    >
                      {step.complete ? "Refazer" : "Começar"}
                    </button>
                  </div>
                ))}
              </div>
              <footer>
                <span>
                  <Trophy /> +{project.xpReward} XP ao concluir
                </span>
                <button
                  className="button button-primary"
                  disabled={!project.complete || project.claimed}
                  onClick={() => claimProject(project.id)}
                >
                  {project.claimed ? "Projeto concluído" : "Concluir projeto"}
                </button>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}

export function WeeklyReportPage() {
  const { state } = useAppState();
  const report = getWeeklyReport(state);
  const strongest = report.strongestSkillId
    ? skillNames[report.strongestSkillId]
    : "Sem evidências ainda";
  const weakest = report.weakestSkillId
    ? skillNames[report.weakestSkillId]
    : "Sem evidências ainda";
  return (
    <div className="standard-page learning-program-page">
      <LearningIntro
        icon={BarChart3}
        eyebrow="RELATÓRIO SEMANAL"
        title="Seus dados, sem números inventados."
        text={`Semana de ${report.week.start} a ${report.week.end}. O relatório é recalculado a partir de tentativas, XP, dicas, dias ativos e evidências salvas.`}
      />
      <section className="report-metrics">
        <ReportMetric label="Dias ativos" value={report.activeDays} />
        <ReportMetric
          label="Exercícios resolvidos"
          value={report.exercisesSolved}
        />
        <ReportMetric label="XP recebido" value={`+${report.xp}`} />
        <ReportMetric label="Taxa de acerto" value={`${report.accuracy}%`} />
        <ReportMetric
          label="Habilidades praticadas"
          value={report.skillsImproved}
        />
        <ReportMetric
          label="Tempo estimado"
          value={`${report.estimatedMinutes} min`}
        />
      </section>
      <section className="report-insights panel-card">
        <div>
          <small>MAIOR DOMÍNIO PRATICADO</small>
          <h2>{strongest}</h2>
        </div>
        <div>
          <small>PRÓXIMO FOCO</small>
          <h2>{weakest}</h2>
        </div>
        <div>
          <small>CONTEXTO REAL</small>
          <p>
            {report.attempts} tentativas · {report.hintsUsed} dicas · linguagem{" "}
            {report.primaryLanguage} · sequência de {report.streak} dia(s).
          </p>
        </div>
      </section>
    </div>
  );
}

const assessment = {
  id: "fundamentos-javascript",
  title: "Fundamentos de JavaScript",
  exerciseIds: ["variaveis", "condicoes", "loops"],
} as const;

export function AssessmentPage() {
  const router = useRouter();
  const { state } = useAppState();
  const attempts = state.attemptHistory.filter(
    (attempt) => attempt.assessmentId === assessment.id,
  );
  const results = assessment.exerciseIds.map((exerciseId) => {
    const exercise = exercises.find(
      (candidate) => candidate.id === exerciseId,
    )!;
    const latest = attempts
      .filter((attempt) => attempt.exerciseId === exerciseId)
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { exercise, latest };
  });
  const attempted = results.filter((result) => result.latest).length;
  const passed = results.filter((result) => result.latest?.passed).length;
  const start = (exerciseId: string) => {
    enableLearningExerciseAccess(exerciseId, "assessment", assessment.id);
    router.push(`/treino/${exerciseId}?modo=prova&etapa=pratica`);
  };
  return (
    <div className="standard-page learning-program-page">
      <LearningIntro
        icon={ClipboardCheck}
        eyebrow="TESTAR MINHAS HABILIDADES"
        title="Modo prova sem punição."
        text="Dicas e tutor ficam pausados durante cada questão. As tentativas atualizam o mapa com peso de avaliação, não removem XP e podem ser refeitas."
      />
      <section className="assessment-summary panel-card">
        <div>
          <small>AVALIAÇÃO</small>
          <h2>{assessment.title}</h2>
          <p>
            {attempted} de {results.length} questões respondidas
          </p>
        </div>
        <div className="assessment-score">
          <b>{attempted ? Math.round((passed / results.length) * 100) : 0}%</b>
          <span>domínio demonstrado</span>
        </div>
      </section>
      <section className="assessment-list">
        {results.map(({ exercise, latest }, index) => (
          <article className="panel-card" key={exercise.id}>
            <span
              className={latest?.passed ? "passed" : latest ? "failed" : ""}
            >
              {latest?.passed ? <CheckCircle2 /> : index + 1}
            </span>
            <div>
              <small>
                {exercise.concept} · {exercise.difficulty}
              </small>
              <h2>{exercise.title}</h2>
              <p>
                {latest
                  ? latest.passed
                    ? `${latest.passedTests} testes passaram.`
                    : `${latest.failedTests} teste(s) ainda falharam.`
                  : "Ainda não respondida."}
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={() => start(exercise.id)}
            >
              {latest ? "Refazer" : "Responder"} <ArrowRight />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function ReportMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <article className="panel-card">
      <b>{value}</b>
      <span>{label}</span>
    </article>
  );
}

function LearningIntro({
  icon: Icon,
  eyebrow,
  title,
  text,
}: {
  icon: typeof Target;
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <header className="page-intro progression-intro">
      <div>
        <span className="section-kicker">
          <Icon /> {eyebrow}
        </span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </header>
  );
}
