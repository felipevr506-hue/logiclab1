"use client";

import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Code2,
  Gift,
  Languages,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import {
  LANGUAGE_CATALOG,
  LEVEL_REWARDS,
  SKILL_CATALOG,
  getLevelProgress,
  type LanguageId,
} from "@/lib/gamification-config";
import { ProgressBar } from "@/components/ui";
import {
  getLanguageRequirementProgress,
  getTotalXp,
} from "@/services/gamification/progression";
import {
  getAdaptiveRecommendation,
  getSkillStatus,
} from "@/services/gamification/mastery";

const skillNames = Object.fromEntries(
  SKILL_CATALOG.map((skill) => [skill.id, skill.title]),
);

export function LanguagesPage() {
  const { state, update, setPrimaryLanguage } = useAppState();
  const unlockedIds = new Set(
    state.userLanguages.map((language) => language.languageId),
  );

  return (
    <div className="standard-page progression-page">
      <ProgressionIntro
        eyebrow="LINGUAGENS"
        icon={Languages}
        title="Uma lógica, várias sintaxes."
        text="No plano gratuito, os desbloqueios usam nível e domínio reais. O plano Pro libera todas as linguagens imediatamente."
      />

      {!state.progressionOnboarded && (
        <section className="progression-onboarding panel-card">
          <Sparkles />
          <div>
            <b>Como a progressão funciona</b>
            <p>
              Nível vem do XP; no plano gratuito, linguagens exigem nível e
              domínio. Assinantes Pro têm acesso ao catálogo completo.
            </p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => update({ progressionOnboarded: true })}
          >
            Entendi
          </button>
        </section>
      )}

      <section className="language-grid">
        {LANGUAGE_CATALOG.map((language) => {
          const unlocked = unlockedIds.has(language.id);
          const requirements = getLanguageRequirementProgress(
            state,
            language.id,
          );
          const userLanguage = state.userLanguages.find(
            (candidate) => candidate.languageId === language.id,
          );
          const isPrimary = state.primaryLanguage === language.id;
          const unlockedByPlan = userLanguage?.unlockedBy === "plan";
          return (
            <article
              className={`language-card panel-card ${unlocked ? "unlocked" : "locked"}`}
              key={language.id}
            >
              <header>
                <span className="language-symbol">
                  <Code2 />
                </span>
                <div>
                  <small>{language.version}</small>
                  <h2>{language.name}</h2>
                </div>
                <span className={`unlock-state ${unlocked ? "available" : ""}`}>
                  {unlocked ? <CheckCircle2 /> : <LockKeyhole />}
                  {unlockedByPlan
                    ? "Incluída no Pro"
                    : unlocked
                      ? "Desbloqueada"
                      : "Bloqueada"}
                </span>
              </header>

              {unlocked ? (
                <>
                  <div className="language-progress-row">
                    <span>
                      Progresso <b>{userLanguage?.progressPercent ?? 0}%</b>
                    </span>
                    <ProgressBar value={userLanguage?.progressPercent ?? 0} />
                  </div>
                  <div className="language-actions">
                    {language.executor === "browser" ? (
                      <Link className="button button-primary" href="/trilha">
                        Continuar trilha <ArrowRight />
                      </Link>
                    ) : (
                      <span className="integration-pending">
                        <ShieldCheck /> Executor sandbox externo necessário
                      </span>
                    )}
                    <button
                      className="button button-secondary"
                      disabled={isPrimary}
                      onClick={() => setPrimaryLanguage(language.id)}
                    >
                      {isPrimary
                        ? "Linguagem principal"
                        : "Definir como principal"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="language-requirements">
                  <p>
                    <Link href="/assinatura">
                      <Sparkles /> Desbloquear agora com o plano Pro
                    </Link>
                  </p>
                  <div>
                    <b>Requisitos</b>
                    <span>
                      {requirements.completed} de {requirements.total}{" "}
                      concluídos
                    </span>
                  </div>
                  <ProgressBar
                    value={(requirements.completed / requirements.total) * 100}
                  />
                  <ul>
                    <li
                      className={requirements.level.complete ? "complete" : ""}
                    >
                      {requirements.level.complete ? (
                        <CheckCircle2 />
                      ) : (
                        <LockKeyhole />
                      )}
                      <span>
                        Nível {requirements.level.required}
                        <small>Atual: nível {requirements.level.current}</small>
                      </span>
                    </li>
                    {requirements.skills.map((skill) => (
                      <li
                        className={skill.complete ? "complete" : ""}
                        key={skill.skillId}
                      >
                        {skill.complete ? <CheckCircle2 /> : <LockKeyhole />}
                        <span>
                          {skillNames[skill.skillId] ?? skill.skillId}
                          <small>
                            {skill.current}% de {skill.required}% de domínio
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <LanguageComparison unlocked={unlockedIds.has("python")} />
    </div>
  );
}

function LanguageComparison({ unlocked }: { unlocked: boolean }) {
  return (
    <section
      className={`syntax-comparison panel-card ${unlocked ? "" : "locked"}`}
    >
      <div className="panel-heading">
        <div>
          <span className="section-kicker">
            <Sparkles /> VOCÊ JÁ SABE ESTE CONCEITO
          </span>
          <h3>Condições têm a mesma lógica</h3>
          <p>A estrutura mental permanece; somente a sintaxe muda.</p>
        </div>
        {!unlocked && (
          <span className="unlock-state">
            <LockKeyhole /> Desbloqueie Python
          </span>
        )}
      </div>
      <div className="syntax-grid">
        <div>
          <b>JavaScript</b>
          <pre>{`if (idade >= 18) {
  console.log("Maior");
}`}</pre>
        </div>
        <ArrowRight />
        <div>
          <b>Python</b>
          <pre>{`if idade >= 18:
    print("Maior")`}</pre>
        </div>
      </div>
    </section>
  );
}

export function SkillsPage() {
  const { state } = useAppState();
  const recommendation = getAdaptiveRecommendation(state);

  return (
    <div className="standard-page progression-page">
      <ProgressionIntro
        eyebrow="MINHAS HABILIDADES"
        icon={BrainCircuit}
        title="Domínio baseado em evidências."
        text="O cálculo considera acertos, dificuldade, tentativas, dicas e atividades recentes — não apenas a quantidade concluída."
      />

      <section className="recommendation-banner panel-card">
        <span>
          <Target /> RECOMENDADO PARA VOCÊ
        </span>
        <div>
          <h2>{recommendation.title}</h2>
          <p>{recommendation.reason}</p>
        </div>
        <Link className="button button-primary" href="/revisar">
          Praticar agora <ArrowRight />
        </Link>
      </section>

      <section className="skills-grid">
        {SKILL_CATALOG.map((skill) => {
          const progress = state.userSkills[skill.id];
          const mastery = progress?.masteryScore ?? 0;
          const status = getSkillStatus(mastery);
          const accuracy = progress?.attempts
            ? Math.round((progress.correctAttempts / progress.attempts) * 100)
            : 0;
          return (
            <article
              className={`skill-card panel-card status-${status}`}
              key={skill.id}
            >
              <header>
                <span>
                  {status === "mastered" ? <CheckCircle2 /> : <BrainCircuit />}
                </span>
                <div>
                  <h2>{skill.title}</h2>
                  <small>
                    {status === "mastered"
                      ? "Dominado"
                      : status === "developing"
                        ? "Em desenvolvimento"
                        : "Precisa revisar"}
                  </small>
                </div>
                <b>{mastery}%</b>
              </header>
              <ProgressBar value={mastery} />
              <div className="skill-stats">
                <span>
                  <b>{progress?.attempts ?? 0}</b>
                  <small>tentativas</small>
                </span>
                <span>
                  <b>{accuracy}%</b>
                  <small>acerto</small>
                </span>
                <span>
                  <b>{progress?.hintsUsed ?? 0}</b>
                  <small>dicas</small>
                </span>
              </div>
              <small className="skill-last-practice">
                <Clock3 />
                {progress?.lastPracticedAt
                  ? `Praticado em ${new Intl.DateTimeFormat("pt-BR").format(new Date(progress.lastPracticedAt))}`
                  : "Nenhuma evidência registrada"}
              </small>
            </article>
          );
        })}
      </section>
    </div>
  );
}

export function RewardsPage() {
  const { state } = useAppState();
  const totalXp = getTotalXp(state.xpTransactions);
  const levelProgress = getLevelProgress(totalXp);
  const grantedIds = new Set(state.rewardGrants.map((grant) => grant.rewardId));
  const upcoming = LEVEL_REWARDS.filter((reward) => !grantedIds.has(reward.id));

  return (
    <div className="standard-page progression-page">
      <ProgressionIntro
        eyebrow="MINHAS RECOMPENSAS"
        icon={Gift}
        title="Cada desbloqueio tem uma origem."
        text="Badges, temas, idiomas e tokens são concedidos uma única vez e ficam ligados ao nível que os liberou."
      />

      <section className="reward-level-card panel-card">
        <span className="level-orb">
          <Trophy />
        </span>
        <div>
          <small>NÍVEL ATUAL</small>
          <h2>Nível {levelProgress.level}</h2>
          <p>
            {totalXp.toLocaleString("pt-BR")} /{" "}
            {levelProgress.nextThreshold.toLocaleString("pt-BR")} XP
          </p>
          <ProgressBar value={levelProgress.percent} />
        </div>
        <span>
          Faltam{" "}
          {(levelProgress.nextThreshold - totalXp).toLocaleString("pt-BR")} XP
        </span>
      </section>

      <div className="reward-columns">
        <section>
          <div className="panel-heading">
            <div>
              <h3>Desbloqueadas</h3>
              <p>{state.rewardGrants.length} recompensas concedidas</p>
            </div>
          </div>
          <div className="reward-list">
            {state.rewardGrants.length ? (
              state.rewardGrants.toReversed().map((grant) => (
                <article
                  className="reward-item panel-card unlocked"
                  key={grant.id}
                >
                  <span>
                    <CheckCircle2 />
                  </span>
                  <div>
                    <small>NÍVEL {grant.level}</small>
                    <h4>{grant.title}</h4>
                    <p>
                      Concedida em{" "}
                      {new Intl.DateTimeFormat("pt-BR").format(
                        new Date(grant.grantedAt),
                      )}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="progression-empty panel-card">
                <Gift />
                <p>A primeira recompensa chega no nível 2.</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="panel-heading">
            <div>
              <h3>Próximas</h3>
              <p>Progressão configurada por nível</p>
            </div>
          </div>
          <div className="reward-list">
            {upcoming.slice(0, 6).map((reward) => (
              <article className="reward-item panel-card" key={reward.id}>
                <span>
                  <LockKeyhole />
                </span>
                <div>
                  <small>NÍVEL {reward.level}</small>
                  <h4>{reward.title}</h4>
                  <p>
                    {Math.max(
                      0,
                      getLevelProgress(totalXp).level < reward.level
                        ? reward.level - state.level
                        : 0,
                    )}{" "}
                    nível(is) restante(s)
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="xp-ledger panel-card">
        <div className="panel-heading">
          <div>
            <h3>Extrato de XP</h3>
            <p>Toda alteração possui motivo e chave antifarm.</p>
          </div>
          <b>{totalXp} XP</b>
        </div>
        {state.xpTransactions.length ? (
          <div className="xp-ledger-list">
            {state.xpTransactions
              .toReversed()
              .slice(0, 20)
              .map((transaction) => (
                <div key={transaction.id}>
                  <span>
                    <Trophy /> +{transaction.amount} XP
                  </span>
                  <div>
                    <b>{transaction.description}</b>
                    <small>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(transaction.createdAt))}
                    </small>
                  </div>
                  <code>{transaction.uniqueKey}</code>
                </div>
              ))}
          </div>
        ) : (
          <div className="progression-empty">
            <Trophy />
            <p>Conclua uma atividade válida para criar a primeira transação.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ProgressionIntro({
  eyebrow,
  icon: Icon,
  title,
  text,
}: {
  eyebrow: string;
  icon: typeof Languages;
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

export function isLanguageRouteAllowed(
  languageId: LanguageId,
  unlocked: Set<LanguageId>,
) {
  return unlocked.has(languageId);
}
