"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Code2,
  Crown,
  Edit3,
  Eye,
  FileText,
  FileCode2,
  Flame,
  FolderHeart,
  Heart,
  Copy,
  Layers3,
  Lightbulb,
  LockKeyhole,
  NotebookPen,
  MessageSquareText,
  Server,
  Plus,
  RefreshCcw,
  Route,
  Search,
  ScrollText,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { levels, exercises } from "@/lib/content";
import { appConfig, formatPrice } from "@/lib/config";
import { useAppState } from "@/lib/app-state";
import { EmptyState, ProgressBar } from "@/components/ui";
import {
  dailyWorkouts,
  getDailyWorkout,
  getUserDailyWorkout,
} from "@/lib/daily-workouts";
import { enableAdminWorkoutPreview } from "@/components/training-access";
import type { FeatureFlagKey } from "@/lib/types";

export function LearningPathPage() {
  const { state } = useAppState();
  const currentWorkout = getUserDailyWorkout(state.user.trainingStartedOn);
  const total = exercises.length;
  const done = state.completedExercises.length;
  return (
    <div className="standard-page">
      <PageIntro
        eyebrow="TRILHA JAVASCRIPT"
        title="Sua jornada, passo a passo."
        text="O próximo conteúdo é liberado quando você pratica o essencial — sem pressa e sem lacunas."
        action={
          <span className="path-language">
            <Code2 /> JavaScript <ChevronDown />
          </span>
        }
      />
      <section className="path-summary panel-card">
        <div>
          <span>
            <Route />
          </span>
          <div>
            <small>PROGRESSO GERAL</small>
            <b>Lógica com JavaScript</b>
            <p>
              {done} de {total} exercícios essenciais concluídos
            </p>
          </div>
        </div>
        <div>
          <b>{Math.round((done / total) * 100)}%</b>
          <ProgressBar value={(done / total) * 100} />
        </div>
      </section>
      <section className="level-stack">
        {levels.map((level, index) => {
          const status =
            index === 0 || done > index
              ? index === 1
                ? "current"
                : "complete"
              : level.status;
          return (
            <article
              className={`level-row level-row-${status}`}
              key={level.number}
            >
              <div className="level-number">
                {status === "complete" ? (
                  <Check />
                ) : status === "locked" ? (
                  <LockKeyhole />
                ) : (
                  level.number
                )}
              </div>
              <div className="level-copy">
                <small>NÍVEL {level.number}</small>
                <h2>{level.title}</h2>
                <p>{level.description}</p>
                <div className="level-modules">
                  {index === 0
                    ? [
                        "Algoritmos",
                        "Sequência lógica",
                        "Variáveis",
                        "Tipos de dados",
                      ].map((item, itemIndex) => (
                        <span
                          key={item}
                          className={itemIndex < done ? "done" : ""}
                        >
                          {itemIndex < done ? <Check /> : <CircleIcon />}
                          {item}
                        </span>
                      ))
                    : index === 1
                      ? ["Operadores", "Entrada e saída", "Condições"].map(
                          (item, itemIndex) => (
                            <span
                              key={item}
                              className={itemIndex === 2 ? "current" : "done"}
                            >
                              {itemIndex === 2 ? <Code2 /> : <Check />}
                              {item}
                            </span>
                          ),
                        )
                      : null}
                </div>
              </div>
              <div className="level-action">
                {status === "complete" ? (
                  <>
                    <BadgeCheck />
                    <span>
                      <b>Concluído</b>
                      <small>Domínio alcançado</small>
                    </span>
                  </>
                ) : status === "current" ? (
                  <>
                    <span className="level-percent">28%</span>
                    <ProgressBar value={28} />
                    <Link href={`/treino/${currentWorkout.exerciseId}`}>
                      Continuar <ArrowRight />
                    </Link>
                  </>
                ) : (
                  <>
                    <LockKeyhole />
                    <span>
                      <b>Bloqueado</b>
                      <small>Conclua o nível anterior</small>
                    </span>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function CircleIcon() {
  return <span className="tiny-circle" />;
}

export function ReviewPage() {
  const { state } = useAppState();
  const reviewItems = exercises.filter(
    (exercise) =>
      (state.hintsUsed[exercise.id] ?? 0) > 0 ||
      (state.attempts[exercise.id] ?? 0) > 1,
  );
  return (
    <div className="standard-page">
      <PageIntro
        eyebrow="REVISÃO INTELIGENTE"
        title="Reforce antes de esquecer."
        text="As revisões são escolhidas pelos seus erros, dicas usadas e tempo desde a última prática."
      />
      <div className="review-overview">
        <article>
          <span>
            <RefreshCcw />
          </span>
          <div>
            <small>PENDENTES</small>
            <b>{Math.max(2, reviewItems.length)}</b>
          </div>
        </article>
        <article>
          <span>
            <BrainIcon />
          </span>
          <div>
            <small>CONCEITO EM FOCO</small>
            <b>Condições</b>
          </div>
        </article>
        <article>
          <span>
            <Clock3 />
          </span>
          <div>
            <small>TEMPO ESTIMADO</small>
            <b>8 min</b>
          </div>
        </article>
      </div>
      <section className="review-queue">
        <div className="panel-heading">
          <div>
            <h3>Fila de hoje</h3>
            <p>Comece pelo item de maior impacto.</p>
          </div>
          <span>Atualizada com seu progresso local</span>
        </div>
        {reviewItems.length ? (
          reviewItems.map((exercise, index) => (
            <Link
              href={`/treino/${exercise.id}`}
              className="review-row"
              key={exercise.id}
            >
              <span
                className={`priority priority-${index ? "medium" : "high"}`}
              >
                {index ? "REFORÇAR" : "PRIORIDADE"}
              </span>
              <span className="review-row-icon">
                <Code2 />
              </span>
              <div>
                <small>{exercise.concept}</small>
                <h3>{exercise.title}</h3>
                <p>
                  {state.attempts[exercise.id] ?? 0} tentativas ·{" "}
                  {state.hintsUsed[exercise.id] ?? 0} dicas usadas
                </p>
              </div>
              <div>
                <span>
                  <Clock3 /> {exercise.minutes} min
                </span>
                <ArrowRight />
              </div>
            </Link>
          ))
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Tudo revisado por enquanto"
            text="Continue os treinos para o sistema identificar os próximos conceitos a reforçar."
            action={
              <Link className="button button-secondary" href="/trilha">
                Explorar a trilha
              </Link>
            }
          />
        )}
      </section>
      <section className="review-explanation">
        <Lightbulb />
        <div>
          <b>Como escolhemos suas revisões?</b>
          <p>
            Priorizamos exercícios com mais tentativas, conceitos em que você
            usou dicas e conteúdos antigos. O objetivo é reforçar, nunca punir.
          </p>
        </div>
      </section>
    </div>
  );
}

function BrainIcon() {
  return <Lightbulb />;
}

export function NotebookPage() {
  const { state, saveNote, toggleFavorite, removeSavedItem } = useAppState();
  const currentWorkout = getUserDailyWorkout(state.user.trainingStartedOn);
  const [tab, setTab] = useState<
    "favorites" | "notes" | "explanations" | "codes" | "review"
  >("favorites");
  const [query, setQuery] = useState("");
  const items =
    tab === "favorites"
      ? exercises.filter((item) => state.favorites.includes(item.id))
      : tab === "notes"
        ? exercises.filter((item) => state.notes[item.id])
        : tab === "review"
          ? exercises.filter(
              (item) => !state.completedExercises.includes(item.id),
            )
          : [];
  const visibleItems = items.filter((item) =>
    `${item.title} ${item.concept} ${item.objective}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="standard-page">
      <PageIntro
        eyebrow="MEU CADERNO"
        title="Tudo que vale lembrar."
        text="Favoritos, anotações, explicações do tutor e códigos salvos, organizados em um só lugar."
        action={
          <label className="search-box">
            <Search />
            <input
              aria-label="Buscar no caderno"
              placeholder="Buscar no caderno"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        }
      />
      <div className="notebook-tabs">
        <button
          className={tab === "favorites" ? "active" : ""}
          onClick={() => setTab("favorites")}
        >
          <Heart /> Favoritos <span>{state.favorites.length}</span>
        </button>
        <button
          className={tab === "notes" ? "active" : ""}
          onClick={() => setTab("notes")}
        >
          <NotebookPen /> Anotações{" "}
          <span>{Object.values(state.notes).filter(Boolean).length}</span>
        </button>
        <button
          className={tab === "explanations" ? "active" : ""}
          onClick={() => setTab("explanations")}
        >
          <MessageSquareText /> Explicações{" "}
          <span>{state.savedTutorExplanations.length}</span>
        </button>
        <button
          className={tab === "codes" ? "active" : ""}
          onClick={() => setTab("codes")}
        >
          <FileCode2 /> Códigos <span>{state.savedCodeSnippets.length}</span>
        </button>
        <button
          className={tab === "review" ? "active" : ""}
          onClick={() => setTab("review")}
        >
          <BookMarked /> Para revisar{" "}
          <span>{exercises.length - state.completedExercises.length}</span>
        </button>
      </div>
      <section className="notebook-grid">
        {tab === "explanations" ? (
          state.savedTutorExplanations.filter((item) =>
            `${item.title} ${item.concept ?? ""} ${item.content}`
              .toLocaleLowerCase("pt-BR")
              .includes(query.trim().toLocaleLowerCase("pt-BR")),
          ).length ? (
            state.savedTutorExplanations
              .filter((item) =>
                `${item.title} ${item.concept ?? ""} ${item.content}`
                  .toLocaleLowerCase("pt-BR")
                  .includes(query.trim().toLocaleLowerCase("pt-BR")),
              )
              .map((item) => (
                <article className="notebook-card saved-material" key={item.id}>
                  <div className="notebook-card-head">
                    <span className="concept-icon">
                      <MessageSquareText />
                    </span>
                    <button
                      onClick={() => removeSavedItem("explanation", item.id)}
                      aria-label="Remover explicação"
                    >
                      <Trash2 />
                    </button>
                  </div>
                  <small>{item.concept ?? "EXPLICAÇÃO DO TUTOR"}</small>
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                  <Link href={`/treino/${item.sourceId}`}>
                    Abrir contexto <ArrowRight />
                  </Link>
                </article>
              ))
          ) : (
            <NotebookEmpty
              query={query}
              workoutId={currentWorkout.exerciseId}
            />
          )
        ) : tab === "codes" ? (
          state.savedCodeSnippets.filter((item) =>
            `${item.title} ${item.language} ${item.code}`
              .toLocaleLowerCase("pt-BR")
              .includes(query.trim().toLocaleLowerCase("pt-BR")),
          ).length ? (
            state.savedCodeSnippets
              .filter((item) =>
                `${item.title} ${item.language} ${item.code}`
                  .toLocaleLowerCase("pt-BR")
                  .includes(query.trim().toLocaleLowerCase("pt-BR")),
              )
              .map((item) => (
                <article className="notebook-card saved-material" key={item.id}>
                  <div className="notebook-card-head">
                    <span className="concept-icon">
                      <FileCode2 />
                    </span>
                    <button
                      onClick={() => removeSavedItem("code", item.id)}
                      aria-label="Remover código"
                    >
                      <Trash2 />
                    </button>
                  </div>
                  <small>{item.language.toUpperCase()}</small>
                  <h3>{item.title}</h3>
                  <pre className="saved-code-preview">{item.code}</pre>
                  <button
                    className="button button-secondary"
                    onClick={() =>
                      void navigator.clipboard.writeText(item.code)
                    }
                  >
                    <Copy /> Copiar código
                  </button>
                </article>
              ))
          ) : (
            <NotebookEmpty
              query={query}
              workoutId={currentWorkout.exerciseId}
            />
          )
        ) : visibleItems.length ? (
          visibleItems.map((exercise) => (
            <article className="notebook-card" key={exercise.id}>
              <div className="notebook-card-head">
                <span className="concept-icon">
                  <Code2 />
                </span>
                <button
                  className={
                    state.favorites.includes(exercise.id) ? "active" : ""
                  }
                  onClick={() => toggleFavorite(exercise.id)}
                  aria-label="Favoritar"
                >
                  <Heart
                    fill={
                      state.favorites.includes(exercise.id)
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              </div>
              <small>
                {exercise.concept} · {exercise.difficulty}
              </small>
              <h3>{exercise.title}</h3>
              <p>{exercise.objective}</p>
              {tab === "notes" ? (
                <textarea
                  value={state.notes[exercise.id] ?? ""}
                  disabled={!state.hydrated}
                  onChange={(event) =>
                    saveNote(exercise.id, event.target.value)
                  }
                  aria-label={`Anotação de ${exercise.title}`}
                />
              ) : (
                <div className="note-preview">
                  <FileText />
                  <input
                    aria-label={`Anotação de ${exercise.title}`}
                    value={state.notes[exercise.id] ?? ""}
                    disabled={!state.hydrated}
                    onChange={(event) =>
                      saveNote(exercise.id, event.target.value)
                    }
                    placeholder="Adicionar uma anotação..."
                  />
                </div>
              )}
              <Link href={`/treino/${exercise.id}`}>
                {state.completedExercises.includes(exercise.id)
                  ? "Refazer exercício"
                  : "Abrir exercício"}{" "}
                <ArrowRight />
              </Link>
            </article>
          ))
        ) : (
          <NotebookEmpty query={query} workoutId={currentWorkout.exerciseId} />
        )}
      </section>
    </div>
  );
}

function NotebookEmpty({
  query,
  workoutId,
}: {
  query: string;
  workoutId: string;
}) {
  return (
    <EmptyState
      icon={FolderHeart}
      title={query ? "Nenhum resultado" : "Nada por aqui ainda"}
      text={
        query
          ? "Tente buscar por outro título, conceito ou conteúdo."
          : "Salve um favorito, uma explicação ou um trecho de código durante o treino."
      }
      action={
        !query && (
          <Link
            className="button button-secondary"
            href={`/treino/${workoutId}`}
          >
            Ir para o treino
          </Link>
        )
      }
    />
  );
}

export function ProfilePage() {
  const { state, update, resetDemo, demoMode, setPrimaryLanguage } =
    useAppState();
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [formReady, setFormReady] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState("");
  const [notificationNotice, setNotificationNotice] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: state.user.name,
    email: state.user.email,
    goal: state.user.goal,
    minutes: state.user.dailyMinutes,
    days: state.user.studyDaysPerWeek ?? 5,
    focus: state.user.studyFocus ?? "Fundamentos e lógica",
  });
  useEffect(() => {
    if (!state.hydrated) return;
    const timer = window.setTimeout(() => {
      setForm({
        name: state.user.name,
        email: state.user.email,
        goal: state.user.goal,
        minutes: state.user.dailyMinutes,
        days: state.user.studyDaysPerWeek ?? 5,
        focus: state.user.studyFocus ?? "Fundamentos e lógica",
      });
      setFormReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    state.hydrated,
    state.user.name,
    state.user.email,
    state.user.goal,
    state.user.dailyMinutes,
    state.user.studyDaysPerWeek,
    state.user.studyFocus,
  ]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError("");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-logiclab-request": "same-origin",
      },
      body: JSON.stringify({
        name: form.name,
        goal: form.goal,
        dailyMinutes: form.minutes,
        studyDaysPerWeek: form.days,
        studyFocus: form.focus,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setProfileError(payload.error ?? "Não foi possível salvar o perfil.");
      return;
    }
    update({
      user: {
        ...state.user,
        name: form.name,
        email: state.user.email,
        goal: form.goal,
        dailyMinutes: form.minutes,
        studyDaysPerWeek: form.days,
        studyFocus: form.focus,
      },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };
  const changeAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setAvatarNotice("Use uma imagem PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > 1_000_000) {
      setAvatarNotice("Escolha uma imagem com até 1 MB.");
      return;
    }
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isPng =
      signature[0] === 0x89 &&
      signature[1] === 0x50 &&
      signature[2] === 0x4e &&
      signature[3] === 0x47;
    const isJpeg = signature[0] === 0xff && signature[1] === 0xd8;
    const isWebp =
      String.fromCharCode(...signature.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
    if (!isPng && !isJpeg && !isWebp) {
      setAvatarNotice(
        "O conteÃºdo do arquivo nÃ£o corresponde a uma imagem aceita.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update({ user: { ...state.user, avatar: String(reader.result) } });
      setAvatarNotice("Foto atualizada.");
    };
    reader.onerror = () => setAvatarNotice("Não foi possível ler essa imagem.");
    reader.readAsDataURL(file);
  };
  return (
    <div className="standard-page">
      <PageIntro
        eyebrow="MINHA CONTA"
        title="Seu perfil."
        text="Ajuste as preferências que personalizam sua rotina de treino."
      />
      <div className="profile-grid">
        <aside className="profile-summary panel-card">
          <div
            className={`profile-avatar ${state.user.avatar ? "has-image" : ""}`}
            style={
              state.user.avatar
                ? { backgroundImage: `url(${state.user.avatar})` }
                : undefined
            }
          >
            {!state.user.avatar &&
              (state.user.name
                .split(" ")
                .map((word) => word[0])
                .slice(0, 2)
                .join("") ||
                "AL")}
            <input
              ref={avatarInput}
              className="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={changeAvatar}
            />
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              aria-label="Alterar foto do perfil"
            >
              <Edit3 />
            </button>
          </div>
          {avatarNotice && (
            <span className="avatar-notice" role="status">
              {avatarNotice}
            </span>
          )}
          <h2>{state.user.name}</h2>
          <p>{state.user.email}</p>
          <span className="profile-level">
            <Trophy /> Nível {state.level}
          </span>
          <div className="profile-stats">
            <div>
              <b>{state.xp}</b>
              <small>XP total</small>
            </div>
            <div>
              <b>{state.streak}</b>
              <small>dias seguidos</small>
            </div>
            <div>
              <b>{state.completedExercises.length}</b>
              <small>exercícios</small>
            </div>
          </div>
          <small>Membro desde agosto de 2026 · Dados da demonstração</small>
        </aside>
        <form className="profile-form panel-card" onSubmit={submit}>
          <div className="form-section-title">
            <div>
              <UserRound />
              <span>
                <b>Informações pessoais</b>
                <small>Como você aparece dentro da plataforma.</small>
              </span>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Nome</span>
              <input
                value={form.name}
                disabled={!formReady}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              <span>E-mail</span>
              <input
                type="email"
                value={form.email}
                readOnly
                aria-describedby="profile-email-help"
              />
              <small id="profile-email-help">
                Altere o e-mail em Conta e seguranÃ§a, com confirmaÃ§Ã£o de
                senha.
              </small>
            </label>
            <label className="full">
              <span>Objetivo principal</span>
              <select
                value={form.goal}
                disabled={!formReady}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
              >
                <option>Resolver exercícios sozinho</option>
                <option>Aprender programação</option>
                <option>Melhorar minha lógica</option>
                <option>Faculdade</option>
              </select>
            </label>
            <label>
              <span>Meta diária</span>
              <select
                value={form.minutes}
                disabled={!formReady}
                onChange={(e) =>
                  setForm({ ...form, minutes: Number(e.target.value) })
                }
              >
                <option value={15}>15 minutos</option>
                <option value={20}>20 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45+ minutos</option>
              </select>
            </label>
            <label>
              <span>Dias de estudo por semana</span>
              <select
                aria-label="Dias de estudo por semana"
                value={form.days}
                disabled={!formReady}
                onChange={(e) =>
                  setForm({ ...form, days: Number(e.target.value) })
                }
              >
                <option value={3}>3 dias</option>
                <option value={4}>4 dias</option>
                <option value={5}>5 dias (recomendado)</option>
                <option value={6}>6 dias</option>
                <option value={7}>Todos os dias</option>
              </select>
            </label>
            <label className="full">
              <span>Foco principal do plano</span>
              <select
                aria-label="Foco principal do plano"
                value={form.focus}
                disabled={!formReady}
                onChange={(e) => setForm({ ...form, focus: e.target.value })}
              >
                <option>Fundamentos e lógica</option>
                <option>Prática e exercícios</option>
                <option>Debugging</option>
                <option>Projetos</option>
                <option>Preparação para faculdade</option>
              </select>
            </label>
            <label>
              <span>Tema</span>
              <select
                value={state.theme}
                disabled={!formReady}
                onChange={(e) =>
                  update({ theme: e.target.value as "dark" | "light" })
                }
              >
                <option value="dark">Escuro</option>
                <option value="light">Claro</option>
              </select>
            </label>
            <label>
              <span>Tamanho da interface</span>
              <select
                aria-label="Tamanho da interface"
                value={state.interfaceSize}
                disabled={!formReady}
                onChange={(e) =>
                  update({
                    interfaceSize: e.target.value as
                      | "compact"
                      | "standard"
                      | "large",
                  })
                }
              >
                <option value="compact">Compacto</option>
                <option value="standard">Padrão</option>
                <option value="large">Grande</option>
              </select>
            </label>
            <label>
              <span>Fonte do editor</span>
              <select
                aria-label="Fonte do editor"
                value={state.editorFontSize}
                disabled={!formReady}
                onChange={(e) =>
                  update({ editorFontSize: Number(e.target.value) })
                }
              >
                <option value={15}>15px</option>
                <option value={16}>16px (padrão)</option>
                <option value={17}>17px</option>
                <option value={18}>18px</option>
                <option value={19}>19px</option>
                <option value={20}>20px</option>
              </select>
            </label>
            <label className="full">
              <span>Linguagem principal</span>
              <select
                aria-label="Linguagem principal"
                value={state.primaryLanguage}
                disabled={!formReady}
                onChange={(event) =>
                  setPrimaryLanguage(
                    event.target.value as typeof state.primaryLanguage,
                  )
                }
              >
                {state.userLanguages.map((language) => (
                  <option key={language.languageId} value={language.languageId}>
                    {language.languageId === "javascript"
                      ? "JavaScript"
                      : language.languageId === "python"
                        ? "Python"
                        : language.languageId === "java"
                          ? "Java"
                          : language.languageId === "c"
                            ? "C"
                            : "C++"}
                  </option>
                ))}
              </select>
              <small>Somente linguagens desbloqueadas aparecem.</small>
            </label>
          </div>
          <section className="profile-preferences">
            <div className="form-section-title">
              <div>
                <Settings2 />
                <span>
                  <b>Acessibilidade e notificações</b>
                  <small>Preferências sincronizadas com seu progresso.</small>
                </span>
              </div>
            </div>
            <label className="preference-toggle">
              <span>
                <b>Reduzir movimentos</b>
                <small>Desativa animações e transições não essenciais.</small>
              </span>
              <input
                type="checkbox"
                checked={state.reducedMotion}
                onChange={(event) =>
                  update({ reducedMotion: event.target.checked })
                }
              />
            </label>
            {(
              [
                ["dailyTraining", "Treino diário"],
                ["reviews", "Revisões pendentes"],
                ["achievements", "Conquistas"],
                ["weeklyGoal", "Meta semanal"],
                ["importantUpdates", "Atualizações importantes"],
              ] as const
            ).map(([key, label]) => (
              <label className="preference-toggle" key={key}>
                <span>
                  <b>{label}</b>
                </span>
                <input
                  type="checkbox"
                  checked={state.notificationPreferences[key]}
                  onChange={(event) =>
                    update({
                      notificationPreferences: {
                        ...state.notificationPreferences,
                        [key]: event.target.checked,
                      },
                    })
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                if (!("Notification" in window)) {
                  setNotificationNotice(
                    "Este navegador não oferece notificações.",
                  );
                  return;
                }
                void Notification.requestPermission().then((permission) =>
                  setNotificationNotice(
                    permission === "granted"
                      ? "Permissão concedida. Os lembretes ainda dependem do site aberto nesta versão."
                      : "Permissão não concedida; os avisos internos continuam disponíveis.",
                  ),
                );
              }}
            >
              Ativar avisos do navegador
            </button>
            {notificationNotice && (
              <small role="status">{notificationNotice}</small>
            )}
          </section>
          <div className="profile-actions">
            {saved && (
              <span>
                <CheckCircle2 /> Alterações salvas
              </span>
            )}
            {profileError && (
              <span className="auth-error" role="alert">
                {profileError}
              </span>
            )}
            <button className="button button-primary" disabled={!formReady}>
              Salvar alterações
            </button>
          </div>
          {demoMode && (
            <div className="danger-zone">
              <div>
                <b>Reiniciar demonstração</b>
                <p>
                  Reinicia progresso, rascunhos, notas e preferências desta
                  conta de demonstração; o estado vazio será sincronizado.
                </p>
              </div>
              <button type="button" onClick={resetDemo}>
                Reiniciar dados
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export function SubscriptionPage() {
  const { state } = useAppState();
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const subscribe = async () => {
    setProcessing(true);
    setNotice("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "x-logiclab-request": "same-origin" },
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !payload.url)
        throw new Error(payload.error ?? "Checkout indisponível.");
      window.location.assign(payload.url);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Checkout indisponível neste ambiente.",
      );
    } finally {
      setProcessing(false);
    }
  };
  return (
    <div className="standard-page">
      <PageIntro
        eyebrow="ASSINATURA"
        title="Continue evoluindo."
        text="Desbloqueie a trilha completa com um plano simples, sem urgência artificial."
      />
      <div className="billing-demo-note">
        <ShieldCheck /> A assinatura só é liberada após confirmação server-side
        do provedor. O retorno visual do checkout não concede acesso sozinho.
      </div>
      <section className="subscription-grid">
        <article className="current-plan panel-card">
          <div className="plan-head">
            <div>
              <span className="plan-icon">
                <Crown />
              </span>
              <div>
                <small>SEU PLANO ATUAL</small>
                <h2>
                  {state.user.plan === "pro" ? "LogicLab Pro" : "Gratuito"}
                </h2>
              </div>
            </div>
            <span
              className={
                state.user.plan === "pro" ? "status-active" : "status-free"
              }
            >
              {state.user.plan === "pro" ? "Ativo" : "Grátis"}
            </span>
          </div>
          <p>
            {state.user.plan === "pro"
              ? "Todos os treinos e todas as linguagens estão liberados neste navegador."
              : `Você pode acessar os ${appConfig.freeExerciseLimit} primeiros exercícios e conhecer o método.`}
          </p>
          <div className="plan-usage">
            <div>
              <span>Exercícios gratuitos usados</span>
              <b>
                {Math.min(
                  appConfig.freeExerciseLimit,
                  state.completedExercises.length,
                )}{" "}
                de {appConfig.freeExerciseLimit}
              </b>
            </div>
            <ProgressBar
              value={Math.min(
                100,
                (state.completedExercises.length /
                  appConfig.freeExerciseLimit) *
                  100,
              )}
            />
          </div>
        </article>
        <article className="upgrade-card">
          <span className="upgrade-kicker">
            <Sparkles /> PLANO COMPLETO
          </span>
          <h2>LogicLab Pro</h2>
          <p className="upgrade-price">
            <strong>{formatPrice(appConfig.monthlyPriceInCents)}</strong>
            <span>/ mês</span>
          </p>
          <ul>
            {[
              "Todas as linguagens desbloqueadas",
              "Treinos e desafios sem limite",
              "Correções e revisões inteligentes",
              "Projetos práticos",
              "Recursos futuros do tutor de IA",
            ].map((item) => (
              <li key={item}>
                <CheckCircle2 />
                {item}
              </li>
            ))}
          </ul>
          <button
            className="button button-primary full-button"
            disabled={processing || state.user.plan === "pro"}
            onClick={subscribe}
          >
            {state.user.plan === "pro" ? (
              "Plano ativo"
            ) : processing ? (
              "Preparando checkout..."
            ) : (
              <>
                Escolher plano Pro <ArrowRight />
              </>
            )}
          </button>
          <small>
            <ShieldCheck /> Cancele quando quiser. Nenhuma garantia falsa.
          </small>
          {notice && (
            <div className="billing-success" role="status">
              <ShieldCheck /> {notice}
            </div>
          )}
        </article>
      </section>
      <section className="payment-architecture panel-card">
        <div>
          <CircleDollarSign />
          <span>
            <b>Integração desacoplada</b>
            <small>Hotmart, Kiwify ou outro provedor</small>
          </span>
        </div>
        <p>
          A interface <code>PaymentGateway</code> mantém a regra de assinatura
          separada dos SDKs. Configure as credenciais no ambiente para conectar
          um checkout real.
        </p>
      </section>
    </div>
  );
}

type AdminItem = {
  id: number;
  title: string;
  kind: string;
  status: "Publicado" | "Rascunho";
  xp: number;
};

type AdminSubscription = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
  user: { email: string; profile: { name: string } | null };
};

export function AdminPage() {
  const { state, update } = useAppState();
  const router = useRouter();
  const currentWorkout = getDailyWorkout();
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(currentWorkout.id);
  const [tab, setTab] = useState<
    | "content"
    | "users"
    | "subscriptions"
    | "analytics"
    | "feedback"
    | "features"
    | "costs"
    | "audit"
    | "health"
    | "settings"
  >("content");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<{
    tutor: {
      requests: number;
      conversations: number;
      successRate: number;
      averageDurationMs: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCostMicros: number;
      positive: number;
      negative: number;
    };
    executor: { mode: string; estimatedServerCpuMs: number; detail: string };
  } | null>(null);
  const [audit, setAudit] = useState<
    Array<{
      id: string;
      actorId: string;
      action: string;
      target: string;
      before: unknown;
      after: unknown;
      ip: string;
      createdAt: string;
    }>
  >([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [subscriptionsTotal, setSubscriptionsTotal] = useState(0);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState("");
  const [healthError, setHealthError] = useState("");
  const [items, setItems] = useState<AdminItem[]>(
    exercises.map((item, index) => ({
      id: index + 1,
      title: item.title,
      kind: item.difficulty === "Desafio" ? "Desafio" : "Exercício",
      status: index < 3 ? "Publicado" : "Rascunho",
      xp: item.xp,
    })),
  );
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("Exercício");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const openNewItem = () => {
    setEditingId(null);
    setTitle("");
    setKind("Exercício");
    setModal(true);
  };
  const openEditItem = (item: AdminItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setKind(item.kind);
    setModal(true);
  };
  const saveItem = (event: FormEvent) => {
    event.preventDefault();
    if (editingId === null)
      setItems((current) => [
        ...current,
        {
          id: Date.now(),
          title,
          kind,
          status: "Rascunho",
          xp: appConfig.xp.easy,
        },
      ]);
    else
      setItems((current) =>
        current.map((item) =>
          item.id === editingId ? { ...item, title, kind } : item,
        ),
      );
    setTitle("");
    setEditingId(null);
    setModal(false);
  };
  const duplicateItem = (item: AdminItem) =>
    setItems((current) => [
      ...current,
      {
        ...item,
        id: Date.now(),
        title: `${item.title} (cópia)`,
        status: "Rascunho",
      },
    ]);
  const published = items.filter((item) => item.status === "Publicado").length;
  const filteredItems = items.filter((item) =>
    item.title
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const previewWorkout = () => {
    const workout = dailyWorkouts.find(
      (candidate) => candidate.id === selectedWorkoutId,
    );
    if (!workout) return;
    enableAdminWorkoutPreview(workout.id);
    router.push(`/treino/${workout.exerciseId}?modo=admin`);
  };
  const analytics = exercises
    .map((exercise) => {
      const attempts = state.attemptHistory.filter(
        (attempt) => attempt.exerciseId === exercise.id,
      );
      const passed = attempts.filter((attempt) => attempt.passed).length;
      return {
        id: exercise.id,
        title: exercise.title,
        attempts: attempts.length,
        failures: attempts.length - passed,
        successRate: attempts.length
          ? Math.round((passed / attempts.length) * 100)
          : 0,
        hints: attempts.reduce((sum, attempt) => sum + attempt.hintsUsed, 0),
      };
    })
    .sort((a, b) => b.failures - a.failures);
  const featureLabels: Record<FeatureFlagKey, string> = {
    AI_TUTOR: "Tutor de IA/local",
    PLAYGROUND: "Playground",
    DAILY_CHALLENGE: "Desafio diário",
    WEEKLY_MISSIONS: "Missões semanais",
    PYTHON_TRACK: "Trilha Python",
    JAVA_TRACK: "Trilha Java",
    C_TRACK: "Trilha C",
    CPP_TRACK: "Trilha C++",
    PORTFOLIO: "Portfólio",
    INTERVIEW_MODE: "Modo entrevista",
  };
  const loadHealth = async () => {
    setHealthError("");
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("status endpoint failed");
      setHealth((await response.json()) as Record<string, unknown>);
    } catch {
      setHealthError("Não foi possível consultar o endpoint de status.");
    }
  };
  const loadUsage = async () => {
    const response = await fetch("/api/admin/usage", { cache: "no-store" });
    if (response.ok) setUsage((await response.json()) as typeof usage);
  };
  const loadAudit = async () => {
    const response = await fetch("/api/admin/audit", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { entries: typeof audit };
      setAudit(payload.entries);
    }
  };
  const loadSubscriptions = async () => {
    setSubscriptionsLoading(true);
    setSubscriptionsError("");
    try {
      const response = await fetch("/api/admin/subscriptions?limit=100", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("subscription endpoint failed");
      const payload = (await response.json()) as {
        subscriptions: AdminSubscription[];
        total: number;
      };
      setSubscriptions(payload.subscriptions);
      setSubscriptionsTotal(payload.total);
    } catch {
      setSubscriptionsError("Não foi possível consultar as assinaturas.");
    } finally {
      setSubscriptionsLoading(false);
    }
  };
  return (
    <div className="standard-page admin-page">
      <div className="admin-demo">
        <ShieldCheck /> Painel administrativo local · conteúdo editorial ainda
        fica nesta sessão; preferências, feedback e flags usam o estado
        sincronizado.
      </div>
      <PageIntro
        eyebrow="ADMINISTRAÇÃO"
        title="Conteúdo e operação."
        text="Gerencie a trilha sem misturar regras editoriais aos componentes do aluno."
        action={
          <button className="button button-primary" onClick={openNewItem}>
            <Plus /> Novo conteúdo
          </button>
        }
      />
      <section className="admin-workout-control panel-card">
        <div>
          <span>
            <CalendarDays />
          </span>
          <div>
            <small>CONTROLE DE PROGRAMAÇÃO</small>
            <h2>Visualizar qualquer treino como administrador</h2>
            <p>
              O aluno recebe somente o treino do dia. A seleção abaixo abre uma
              prévia administrativa sem liberar os demais conteúdos.
            </p>
          </div>
        </div>
        <label>
          <span>Treino para visualizar</span>
          <select
            aria-label="Treino para visualizar"
            value={selectedWorkoutId}
            onChange={(event) => setSelectedWorkoutId(event.target.value)}
          >
            {dailyWorkouts.map((workout) => (
              <option key={workout.id} value={workout.id}>
                Treino {String(workout.day).padStart(2, "0")} ·{" "}
                {workout.shortTitle}
                {workout.id === currentWorkout.id ? " (hoje)" : " (bloqueado)"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button button-primary"
          onClick={previewWorkout}
        >
          <Eye /> Visualizar como admin
        </button>
        <button
          className={tab === "analytics" ? "active" : ""}
          onClick={() => setTab("analytics")}
        >
          <BarChart3 /> Analytics
        </button>
        <button
          className={tab === "feedback" ? "active" : ""}
          onClick={() => setTab("feedback")}
        >
          <MessageSquareText /> Feedback
        </button>
        <button
          className={tab === "features" ? "active" : ""}
          onClick={() => setTab("features")}
        >
          <Settings2 /> Feature flags
        </button>
        <button
          className={tab === "health" ? "active" : ""}
          onClick={() => setTab("health")}
        >
          <Server /> Serviços
        </button>
        <button
          className={tab === "costs" ? "active" : ""}
          onClick={() => {
            setTab("costs");
            void loadUsage();
          }}
        >
          <CircleDollarSign /> Custos e uso
        </button>
        <button
          className={tab === "audit" ? "active" : ""}
          onClick={() => {
            setTab("audit");
            void loadAudit();
          }}
        >
          <ScrollText /> Auditoria
        </button>
      </section>
      <section className="admin-metrics">
        <article>
          <UsersRound />
          <div>
            <small>USUÁRIOS TOTAIS</small>
            <b>1</b>
            <span>perfil local de demonstração</span>
          </div>
        </article>
        <article>
          <Activity />
          <div>
            <small>USUÁRIOS ATIVOS</small>
            <b>1</b>
            <span>neste navegador</span>
          </div>
        </article>
        <article>
          <BookOpen />
          <div>
            <small>TREINOS PUBLICADOS</small>
            <b>{published}</b>
            <span>de {items.length} conteúdos</span>
          </div>
        </article>
        <article>
          <CheckCircle2 />
          <div>
            <small>EXERCÍCIOS CONCLUÍDOS</small>
            <b>{state.completedExercises.length}</b>
            <span>progresso local</span>
          </div>
        </article>
      </section>
      <div className="admin-tabs">
        <button
          className={tab === "content" ? "active" : ""}
          onClick={() => setTab("content")}
        >
          <Layers3 /> Conteúdo
        </button>
        <button
          className={tab === "users" ? "active" : ""}
          onClick={() => setTab("users")}
        >
          <UsersRound /> Usuários
        </button>
        <button
          className={tab === "subscriptions" ? "active" : ""}
          onClick={() => {
            setTab("subscriptions");
            void loadSubscriptions();
          }}
        >
          <CircleDollarSign /> Assinaturas
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          onClick={() => setTab("settings")}
        >
          <Settings2 /> Configurações
        </button>
      </div>
      {tab === "content" ? (
        <section className="admin-table panel-card">
          <div className="table-toolbar">
            <div>
              <h3>Exercícios e desafios</h3>
              <span>
                {filteredItems.length} de {items.length} itens
              </span>
            </div>
            <label>
              <Search />
              <input
                aria-label="Buscar conteúdo"
                placeholder="Buscar conteúdo"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="table-head">
            <span>CONTEÚDO</span>
            <span>TIPO</span>
            <span>XP</span>
            <span>STATUS</span>
            <span>AÇÕES</span>
          </div>
          {filteredItems.map((item) => (
            <div className="table-row" key={item.id}>
              <div>
                <span className="table-icon">
                  <Code2 />
                </span>
                <div>
                  <b>{item.title}</b>
                  <small>JavaScript · Ordem {item.id}</small>
                </div>
              </div>
              <span>{item.kind}</span>
              <span>+{item.xp} XP</span>
              <button
                className={`status-button status-${item.status === "Publicado" ? "published" : "draft"}`}
                onClick={() =>
                  setItems((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id
                        ? {
                            ...candidate,
                            status:
                              candidate.status === "Publicado"
                                ? "Rascunho"
                                : "Publicado",
                          }
                        : candidate,
                    ),
                  )
                }
              >
                {item.status}
              </button>
              <div>
                <button
                  aria-label={`Editar ${item.title}`}
                  onClick={() => openEditItem(item)}
                >
                  <Edit3 />
                </button>
                <button
                  aria-label={`Duplicar ${item.title}`}
                  onClick={() => duplicateItem(item)}
                >
                  <Copy />
                </button>
                <button
                  aria-label="Excluir"
                  onClick={() =>
                    setItems((current) =>
                      current.filter((candidate) => candidate.id !== item.id),
                    )
                  }
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : tab === "users" ? (
        <section className="admin-table panel-card">
          <div className="table-toolbar">
            <div>
              <h3>Usuários</h3>
              <span>Somente registros reais apareceriam aqui</span>
            </div>
          </div>
          <div className="user-demo-row">
            <span className="avatar">AL</span>
            <div>
              <b>{state.user.name}</b>
              <small>{state.user.email}</small>
            </div>
            <span>{state.user.plan === "pro" ? "Pro" : "Gratuito"}</span>
            <span>{state.xp} XP</span>
            <span>
              <Flame /> {state.streak} dias
            </span>
          </div>
        </section>
      ) : tab === "subscriptions" ? (
        <section className="admin-table panel-card admin-subscriptions">
          <div className="table-toolbar">
            <div>
              <h3>Assinaturas</h3>
              <span>{subscriptionsTotal} registros no banco</span>
            </div>
            <button
              className="button button-secondary"
              disabled={subscriptionsLoading}
              onClick={() => void loadSubscriptions()}
            >
              <RefreshCcw />
              {subscriptionsLoading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
          {subscriptionsError ? (
            <p className="state-error admin-subscriptions-state">
              {subscriptionsError}
            </p>
          ) : subscriptionsLoading && !subscriptions.length ? (
            <p className="admin-subscriptions-state">
              Carregando assinaturas...
            </p>
          ) : subscriptions.length ? (
            <div className="admin-subscriptions-scroll">
              <div className="subscription-admin-head" aria-hidden="true">
                <span>USUÁRIO</span>
                <span>PLANO / STATUS</span>
                <span>PROVEDOR</span>
                <span>IDENTIFICADOR</span>
                <span>PERÍODO</span>
              </div>
              {subscriptions.map((subscription) => (
                <article
                  className="subscription-admin-row"
                  key={subscription.id}
                >
                  <div>
                    <b>{subscription.user.profile?.name || "Sem nome"}</b>
                    <small>{subscription.user.email}</small>
                  </div>
                  <div>
                    <b>{subscription.planId}</b>
                    <small>{subscription.status}</small>
                  </div>
                  <div>
                    <b>{subscription.provider}</b>
                    <small>
                      {subscription.cancelAtPeriodEnd
                        ? "Cancela ao fim do período"
                        : "Renovação normal"}
                    </small>
                  </div>
                  <div>
                    <b>{subscription.providerSubscriptionId || "—"}</b>
                    <small>{subscription.providerCustomerId || "—"}</small>
                  </div>
                  <div>
                    <b>
                      {subscription.currentPeriodEnd
                        ? new Date(
                            subscription.currentPeriodEnd,
                          ).toLocaleDateString("pt-BR")
                        : "Sem término informado"}
                    </b>
                    <small>
                      Atualizado em{" "}
                      {new Date(subscription.updatedAt).toLocaleString("pt-BR")}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <CircleDollarSign />
              <h3>Nenhuma assinatura registrada</h3>
              <p>Os registros confirmados pelo backend aparecerão aqui.</p>
            </div>
          )}
        </section>
      ) : tab === "analytics" ? (
        <section className="admin-table panel-card admin-analytics">
          <div className="table-toolbar">
            <div>
              <h3>Desempenho por exercício</h3>
              <span>Dados reais deste perfil sincronizado</span>
            </div>
          </div>
          <div className="analytics-head">
            <span>EXERCÍCIO</span>
            <span>TENTATIVAS</span>
            <span>FALHAS</span>
            <span>ACERTO</span>
            <span>DICAS</span>
          </div>
          {analytics.map((item) => (
            <div className="analytics-row" key={item.id}>
              <b>{item.title}</b>
              <span>{item.attempts}</span>
              <span>{item.failures}</span>
              <span>{item.successRate}%</span>
              <span>{item.hints}</span>
            </div>
          ))}
        </section>
      ) : tab === "feedback" ? (
        <section className="admin-table panel-card admin-feedback-list">
          <div className="table-toolbar">
            <div>
              <h3>Feedback e problemas reportados</h3>
              <span>
                {state.exerciseFeedback.length} registros sincronizados
              </span>
            </div>
          </div>
          {state.exerciseFeedback.length ? (
            state.exerciseFeedback
              .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((feedback) => (
                <article key={feedback.id}>
                  <div>
                    <b>
                      {exercises.find((item) => item.id === feedback.exerciseId)
                        ?.title ?? feedback.exerciseId}
                    </b>
                    <small>
                      {feedback.reportReason ??
                        feedback.sentiment ??
                        "comentário"}{" "}
                      · {new Date(feedback.createdAt).toLocaleString("pt-BR")}
                    </small>
                    {feedback.comment && <p>{feedback.comment}</p>}
                  </div>
                  <select
                    aria-label={`Status do feedback ${feedback.id}`}
                    value={feedback.status}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        exerciseFeedback: current.exerciseFeedback.map(
                          (item) =>
                            item.id === feedback.id
                              ? {
                                  ...item,
                                  status: event.target
                                    .value as typeof item.status,
                                }
                              : item,
                        ),
                      }))
                    }
                  >
                    <option value="new">Novo</option>
                    <option value="reviewing">Em análise</option>
                    <option value="resolved">Resolvido</option>
                    <option value="ignored">Ignorado</option>
                  </select>
                </article>
              ))
          ) : (
            <div className="empty-state compact">
              <MessageSquareText />
              <h3>Nenhum feedback recebido</h3>
              <p>Os envios feitos no treino aparecerão aqui.</p>
            </div>
          )}
        </section>
      ) : tab === "features" ? (
        <section className="admin-settings panel-card feature-flags">
          <h3>Feature flags</h3>
          <p>
            As flags são persistidas e sincronizadas. Recursos ainda não
            implementados permanecem identificados pelo nome, sem tela fictícia.
          </p>
          {(Object.keys(state.featureFlags) as FeatureFlagKey[]).map((key) => (
            <label className="preference-toggle" key={key}>
              <span>
                <b>{featureLabels[key]}</b>
                <small>{key}</small>
              </span>
              <input
                type="checkbox"
                checked={state.featureFlags[key]}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  update({
                    featureFlags: {
                      ...state.featureFlags,
                      [key]: enabled,
                    },
                  });
                  void fetch("/api/features", {
                    method: "PUT",
                    headers: {
                      "content-type": "application/json",
                      "x-logiclab-request": "same-origin",
                    },
                    body: JSON.stringify({ key, enabled }),
                  });
                }}
              />
            </label>
          ))}
        </section>
      ) : tab === "audit" ? (
        <section className="admin-table panel-card admin-audit-list">
          <div className="table-toolbar">
            <div>
              <h3>Auditoria administrativa</h3>
              <span>Quem alterou, quando e o valor anterior/posterior</span>
            </div>
            <button
              className="button button-secondary"
              onClick={() => void loadAudit()}
            >
              <RefreshCcw /> Atualizar
            </button>
          </div>
          {audit.length ? (
            audit.map((entry) => (
              <article key={entry.id}>
                <ScrollText />
                <div>
                  <b>{entry.action}</b>
                  <small>
                    {entry.target} ·{" "}
                    {new Date(entry.createdAt).toLocaleString("pt-BR")}
                  </small>
                  <span>
                    {String(entry.before)} → {String(entry.after)} · ator{" "}
                    {entry.actorId}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state compact">
              <ScrollText />
              <h3>Nenhuma alteração administrativa registrada</h3>
              <p>Ações persistidas aparecerão aqui.</p>
            </div>
          )}
        </section>
      ) : tab === "costs" ? (
        <section className="admin-settings panel-card admin-costs">
          <div className="table-toolbar">
            <div>
              <h3>Custos e uso</h3>
              <span>Sem conteúdo de conversas ou código do aluno</span>
            </div>
            <button
              className="button button-secondary"
              onClick={() => void loadUsage()}
            >
              <RefreshCcw /> Atualizar
            </button>
          </div>
          {!usage ? (
            <p>Carregando uso agregado...</p>
          ) : (
            <div className="settings-grid">
              <div>
                <small>REQUISIÇÕES DO TUTOR</small>
                <b>{usage.tutor.requests}</b>
              </div>
              <div>
                <small>CONVERSAS</small>
                <b>{usage.tutor.conversations}</b>
              </div>
              <div>
                <small>SUCESSO</small>
                <b>{usage.tutor.successRate}%</b>
              </div>
              <div>
                <small>TEMPO MÉDIO</small>
                <b>{usage.tutor.averageDurationMs} ms</b>
              </div>
              <div>
                <small>FEEDBACK POSITIVO</small>
                <b>{usage.tutor.positive}</b>
              </div>
              <div>
                <small>FEEDBACK NEGATIVO</small>
                <b>{usage.tutor.negative}</b>
              </div>
              <div>
                <small>TOKENS EXTERNOS</small>
                <b>{usage.tutor.inputTokens + usage.tutor.outputTokens}</b>
              </div>
              <div>
                <small>CUSTO ESTIMADO</small>
                <b>
                  R$ {(usage.tutor.estimatedCostMicros / 1_000_000).toFixed(4)}
                </b>
              </div>
              <div>
                <small>EXECUTOR</small>
                <b>{usage.executor.mode}</b>
                <span>{usage.executor.detail}</span>
              </div>
            </div>
          )}
        </section>
      ) : tab === "health" ? (
        <section className="admin-settings panel-card service-health">
          <div className="table-toolbar">
            <div>
              <h3>Status dos serviços</h3>
              <span>Sem mascarar integrações ausentes</span>
            </div>
            <button
              className="button button-secondary"
              onClick={() => void loadHealth()}
            >
              <RefreshCcw /> Atualizar status
            </button>
          </div>
          {!health && !healthError && (
            <p>Clique em atualizar para consultar o servidor.</p>
          )}
          {healthError && <p className="state-error">{healthError}</p>}
          {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
        </section>
      ) : (
        <section className="admin-settings panel-card">
          <h3>Configurações centralizadas</h3>
          <div className="settings-grid">
            <label>
              <span>Preço mensal (centavos)</span>
              <input readOnly value={appConfig.monthlyPriceInCents} />
            </label>
            <label>
              <span>Limite gratuito</span>
              <input readOnly value={appConfig.freeExerciseLimit} />
            </label>
            <label>
              <span>XP exercício fácil</span>
              <input readOnly value={appConfig.xp.easy} />
            </label>
            <label>
              <span>XP desafio</span>
              <input readOnly value={appConfig.xp.challenge} />
            </label>
          </div>
          <p>
            Valores definidos em <code>lib/config.ts</code>. Em produção, esta
            tela gravaria as alterações no banco com histórico de auditoria.
          </p>
        </section>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingId === null ? "Novo conteúdo" : "Editar conteúdo"}
        >
          <form className="admin-modal" onSubmit={saveItem}>
            <div>
              <span>
                <Plus />
              </span>
              <div>
                <small>
                  {editingId === null ? "NOVO CONTEÚDO" : "EDITAR CONTEÚDO"}
                </small>
                <h2>
                  {editingId === null ? "Criar exercício" : "Editar exercício"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fechar janela"
                onClick={() => setModal(false)}
              >
                <X />
              </button>
            </div>
            <label>
              <span>Título</span>
              <input
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Comparando duas idades"
              />
            </label>
            <label>
              <span>Tipo</span>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option>Exercício</option>
                <option>Desafio</option>
                <option>Aula</option>
              </select>
            </label>
            <p>
              {editingId === null
                ? "O novo item será criado como rascunho para você completar testes, dicas e explicação antes de publicar."
                : "As alterações atualizam este conteúdo apenas durante a sessão de demonstração."}
            </p>
            <div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
              <button className="button button-primary">
                {editingId === null ? "Criar rascunho" : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PageIntro({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-intro">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </header>
  );
}
