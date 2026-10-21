"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  FileCode2,
  FolderKanban,
  Heart,
  LockKeyhole,
  MessageSquareText,
  Search,
} from "lucide-react";
import { enableLearningExerciseAccess } from "@/components/training-access";
import { exercises } from "@/lib/content";
import { getUserWorkoutSchedule } from "@/lib/daily-workouts";
import { GLOSSARY, searchGlossary } from "@/lib/glossary";
import { PROJECT_CATALOG } from "@/lib/learning-program";
import { useAppState } from "@/lib/app-state";
import type { ProgrammingLanguageId } from "@/lib/types";

const languageLabels: Record<ProgrammingLanguageId, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
};

export function GlossaryPage() {
  const { state, update } = useAppState();
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<ProgrammingLanguageId | "all">(
    "all",
  );
  const entries = searchGlossary(query).filter(
    (entry) => language === "all" || entry.languages.includes(language),
  );
  const unlocked = state.userLanguages.map((item) => item.languageId);
  return (
    <main className="standard-page library-page">
      <header className="page-intro">
        <div>
          <span>CONSULTA RÁPIDA</span>
          <h1>Glossário de programação</h1>
          <p>
            Definições curtas, exemplos e links para praticar cada conceito.
          </p>
        </div>
        <label className="search-box">
          <Search />
          <input
            aria-label="Buscar no glossário"
            placeholder="Buscar termo ou definição"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>
      <div className="filter-tabs glossary-tabs">
        <button
          className={language === "all" ? "active" : ""}
          onClick={() => setLanguage("all")}
        >
          Todas
        </button>
        {(Object.keys(languageLabels) as ProgrammingLanguageId[]).map(
          (item) => (
            <button
              key={item}
              disabled={!unlocked.includes(item)}
              className={language === item ? "active" : ""}
              onClick={() => setLanguage(item)}
            >
              {languageLabels[item]}
              {!unlocked.includes(item) && <LockKeyhole />}
            </button>
          ),
        )}
      </div>
      <section className="glossary-grid">
        {entries.map((entry) => {
          const favorite = state.favoriteConcepts.includes(entry.id);
          return (
            <article key={entry.id} id={entry.id}>
              <header>
                <BookOpen />
                <button
                  aria-label={
                    favorite ? "Remover dos favoritos" : "Favoritar conceito"
                  }
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      favoriteConcepts: favorite
                        ? current.favoriteConcepts.filter(
                            (id) => id !== entry.id,
                          )
                        : [...current.favoriteConcepts, entry.id],
                    }))
                  }
                >
                  <Heart fill={favorite ? "currentColor" : "none"} />
                </button>
              </header>
              <h2>{entry.term}</h2>
              <p>{entry.definition}</p>
              <pre>{entry.example}</pre>
              {entry.relatedExerciseIds.map((exerciseId) => (
                <Link
                  href={`/treino/${exerciseId}?modo=pratica`}
                  key={exerciseId}
                  onClick={() =>
                    enableLearningExerciseAccess(exerciseId, "practice")
                  }
                >
                  Praticar conceito <ArrowRight />
                </Link>
              ))}
            </article>
          );
        })}
      </section>
      {!entries.length && (
        <div className="empty-state compact">
          <Search />
          <h3>Nenhum termo encontrado</h3>
          <p>Tente outra palavra ou selecione todas as linguagens.</p>
        </div>
      )}
    </main>
  );
}

type SearchResult = {
  id: string;
  kind: "exercise" | "project" | "term" | "note" | "explanation" | "code";
  title: string;
  description: string;
  href: string;
  locked?: boolean;
  exerciseId?: string;
};

export function GlobalSearchPage() {
  const { state } = useAppState();
  const [query, setQuery] = useState("");
  const workoutSchedule = useMemo(
    () => getUserWorkoutSchedule(state.user.trainingStartedOn),
    [state.user.trainingStartedOn],
  );
  const currentExerciseId = workoutSchedule.find(
    (workout) => workout.isCurrent,
  )!.exerciseId;
  const unlockedExerciseIds = useMemo(
    () =>
      new Set(
        workoutSchedule
          .filter((workout) => workout.isUnlocked)
          .map((workout) => workout.exerciseId),
      ),
    [workoutSchedule],
  );
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (normalized.length < 2) return [];
    const matches = (value: string) =>
      value.toLocaleLowerCase("pt-BR").includes(normalized);
    const exerciseResults: SearchResult[] = exercises
      .filter((item) =>
        matches(`${item.title} ${item.concept} ${item.objective}`),
      )
      .map((item) => ({
        id: `exercise-${item.id}`,
        kind: "exercise",
        title: item.title,
        description: `${item.concept} · ${item.objective}`,
        href: `/treino/${item.id}?modo=pratica`,
        exerciseId: item.id,
        locked: !unlockedExerciseIds.has(item.id),
      }));
    const projectResults: SearchResult[] = PROJECT_CATALOG.filter((item) =>
      matches(`${item.title} ${item.description}`),
    ).map((item) => ({
      id: `project-${item.id}`,
      kind: "project",
      title: item.title,
      description: item.description,
      href: `/projetos#${item.id}`,
      locked: state.level < item.requiredLevel,
    }));
    const termResults: SearchResult[] = GLOSSARY.filter((item) =>
      matches(
        `${item.term} ${item.definition} ${(item.aliases ?? []).join(" ")}`,
      ),
    ).map((item) => ({
      id: `term-${item.id}`,
      kind: "term",
      title: item.term,
      description: item.definition,
      href: `/glossario#${item.id}`,
    }));
    const noteResults: SearchResult[] = Object.entries(state.notes)
      .filter(([, note]) => matches(note))
      .map(([exerciseId, note]) => ({
        id: `note-${exerciseId}`,
        kind: "note",
        title:
          exercises.find((item) => item.id === exerciseId)?.title ?? "Anotação",
        description: note,
        href: "/caderno",
      }));
    const explanationResults: SearchResult[] = state.savedTutorExplanations
      .filter((item) => matches(`${item.title} ${item.content}`))
      .map((item) => ({
        id: `explanation-${item.id}`,
        kind: "explanation",
        title: item.title,
        description: item.content,
        href: "/caderno",
      }));
    const codeResults: SearchResult[] = state.savedCodeSnippets
      .filter((item) => matches(`${item.title} ${item.code}`))
      .map((item) => ({
        id: `code-${item.id}`,
        kind: "code",
        title: item.title,
        description: `${item.language} · trecho salvo`,
        href: "/caderno",
      }));
    return [
      ...exerciseResults,
      ...projectResults,
      ...termResults,
      ...noteResults,
      ...explanationResults,
      ...codeResults,
    ].slice(0, 40);
  }, [query, state, unlockedExerciseIds]);

  const icons = {
    exercise: BookOpen,
    project: FolderKanban,
    term: BookOpen,
    note: MessageSquareText,
    explanation: MessageSquareText,
    code: FileCode2,
  };
  return (
    <main className="standard-page global-search-page">
      <header className="page-intro">
        <div>
          <span>BUSCA GLOBAL</span>
          <h1>Encontre qualquer conteúdo</h1>
          <p>Exercícios, projetos, conceitos, anotações e materiais salvos.</p>
        </div>
      </header>
      <label className="global-search-input">
        <Search />
        <input
          autoFocus
          aria-label="Busca global"
          placeholder="Digite pelo menos 2 caracteres..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <section className="global-search-results" aria-live="polite">
        {results.map((result) => {
          const Icon = icons[result.kind];
          const content = (
            <>
              <span>
                <Icon />
              </span>
              <div>
                <small>{result.kind}</small>
                <h2>{result.title}</h2>
                <p>{result.description}</p>
              </div>
              {result.locked ? <LockKeyhole /> : <ArrowRight />}
            </>
          );
          return result.locked ? (
            <article
              className="locked"
              key={result.id}
              title="Conteúdo ainda bloqueado"
            >
              {content}
            </article>
          ) : (
            <Link
              href={result.href}
              key={result.id}
              onClick={() => {
                if (
                  result.exerciseId &&
                  result.exerciseId !== currentExerciseId
                )
                  enableLearningExerciseAccess(result.exerciseId, "practice");
              }}
            >
              {content}
            </Link>
          );
        })}
        {query.trim().length >= 2 && !results.length && (
          <div className="empty-state compact">
            <Search />
            <h3>Nenhum resultado</h3>
            <p>Revise a busca ou consulte o glossário.</p>
          </div>
        )}
      </section>
    </main>
  );
}
