import { Heart, Lightbulb } from "lucide-react";
import type { Exercise } from "@/lib/types";
import type { DailyWorkout } from "@/lib/daily-workouts";
import { GlossaryPopover } from "@/components/glossary-popover";
import styles from "./workspace.module.css";

export function ProblemPanel({
  exercise,
  workout,
  active,
  hintCount,
  onHint,
  assessment,
  favorite,
  onFavorite,
}: {
  exercise: Exercise;
  workout: DailyWorkout;
  active: boolean;
  hintCount: number;
  onHint: () => void;
  assessment: boolean;
  favorite: boolean;
  onFavorite: () => void;
}) {
  const example =
    exercise.tests.find((test) => test.expectedLogs) ??
    exercise.tests.find((test) => test.expression) ??
    exercise.tests[0];
  return (
    <aside
      className={styles.problem}
      data-active={active}
      aria-label="Problema"
    >
      <div className={styles.problemHeading}>
        <GlossaryPopover term={exercise.concept} />
        <button
          aria-label="Favoritar exercício"
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <Heart fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <h1>{exercise.title}</h1>
      <p className={styles.objective}>{exercise.objective}</p>
      <h2>O que fazer</h2>
      <ol>
        {exercise.instructions.map((instruction) => (
          <li key={instruction}>{instruction}</li>
        ))}
      </ol>
      {example && (
        <div className={styles.example}>
          <h2>Exemplo esperado</h2>
          <code>{example.expression ?? "Saída no console"}</code>
          <span>→</span>
          <code>
            {JSON.stringify(example.expectedLogs ?? example.expected) ??
              "Saída esperada"}
          </code>
        </div>
      )}
      <details className={styles.secondary}>
        <summary>Conceito e detalhes</summary>
        <p>{exercise.explanation}</p>
        {workout.learn.map((block) => (
          <section key={block.marker}>
            <h3>{block.title}</h3>
            <p>{block.text}</p>
          </section>
        ))}
      </details>
      {!assessment && (
        <details className={styles.secondary}>
          <summary>
            Dicas progressivas · {hintCount}/{exercise.hints.length}
          </summary>
          {exercise.hints.slice(0, hintCount).map((hint, index) => (
            <p key={hint}>
              <b>Dica {index + 1}:</b> {hint}
            </p>
          ))}
          {hintCount < exercise.hints.length && (
            <button className="button button-secondary" onClick={onHint}>
              <Lightbulb /> Ver dica {hintCount + 1}
            </button>
          )}
        </details>
      )}
      {assessment && <p>A ajuda está pausada durante esta avaliação.</p>}
      <small>Seu código é salvo automaticamente nesta conta.</small>
    </aside>
  );
}
