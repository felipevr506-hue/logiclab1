"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Clock3,
  Code2,
  Sparkles,
  Target,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { useAppState } from "@/lib/app-state";
import { useAppLocale } from "@/lib/use-app-locale";

const questions = [
  {
    title: "Você já programou antes?",
    subtitle: "Isso nos ajuda a escolher o ponto de partida.",
    icon: Code2,
    key: "experience",
    options: [
      ["Nunca", "Vou começar do zero"],
      ["Um pouco", "Já testei alguns conceitos"],
      ["Já fiz cursos", "Conheço a teoria, mas travo na prática"],
    ],
  },
  {
    title: "Qual é o seu principal objetivo?",
    subtitle: "Vamos destacar os treinos que mais ajudam você.",
    icon: Target,
    key: "goal",
    options: [
      ["Aprender programação", "Construir uma base sólida"],
      ["Melhorar minha lógica", "Raciocinar com mais clareza"],
      ["Resolver exercícios sozinho", "Parar de depender de respostas prontas"],
      ["Faculdade", "Acompanhar melhor as disciplinas"],
    ],
  },
  {
    title: "Quanto tempo quer treinar por dia?",
    subtitle: "Você pode mudar isso a qualquer momento.",
    icon: Clock3,
    key: "minutes",
    options: [
      ["15 minutos", "Uma prática bem rápida"],
      ["20 minutos", "Um treino enxuto"],
      ["30 minutos", "Ritmo recomendado"],
      ["45+ minutos", "Quero ir mais fundo"],
    ],
  },
] as const;

const englishQuestions = [
  {
    title: "Have you programmed before?",
    subtitle: "This helps us choose the right starting point.",
    options: [
      ["Never", "I'll start from scratch"],
      ["A little", "I've tried a few concepts"],
      ["I've taken courses", "I know the theory but need practice"],
    ],
  },
  {
    title: "What is your main goal?",
    subtitle: "We'll highlight the sessions that help you most.",
    options: [
      ["Learn programming", "Build a solid foundation"],
      ["Improve my logic", "Reason more clearly"],
      ["Solve exercises independently", "Rely less on ready-made answers"],
      ["College", "Keep up with my classes"],
    ],
  },
  {
    title: "How much time do you want to practice each day?",
    subtitle: "You can change this at any time.",
    options: [
      ["15 minutes", "A very quick session"],
      ["20 minutes", "A focused session"],
      ["30 minutes", "Recommended pace"],
      ["45+ minutes", "I want to go deeper"],
    ],
  },
] as const;

export function Onboarding() {
  const router = useRouter();
  const { state, update } = useAppState();
  const { locale, setLocale } = useAppLocale();
  const english = locale === "en";
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState({
    experience: state.user.experience,
    goal: state.user.goal,
    minutes: String(state.user.dailyMinutes),
    locale: state.user.locale ?? "pt-BR",
    initialLanguage: state.user.initialLanguage ?? "javascript",
  });
  const question = questions[step];
  const translatedQuestion = englishQuestions[step];
  const QuestionIcon = question.icon;
  const selected = answers[question.key];

  const saveProfile = async () => {
    setSaving(true);
    setError("");
    const dailyMinutes = Number(answers.minutes.replace(/\D/g, "")) || 30;
    const response = await fetch("/api/profile/onboarding", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-logiclab-request": "same-origin",
      },
      body: JSON.stringify({
        experience: answers.experience,
        goal: answers.goal,
        dailyMinutes,
        locale: answers.locale,
        initialLanguage: answers.initialLanguage,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSaving(false);
      throw new Error(payload.error ?? "Não foi possível salvar seu perfil.");
    }
    update({
      user: {
        ...state.user,
        experience: answers.experience,
        goal: answers.goal,
        dailyMinutes,
        locale: answers.locale,
        initialLanguage: answers.initialLanguage,
        onboarded: true,
      },
    });
    setSaving(false);
  };

  const complete = async (destination: string) => {
    try {
      await saveProfile();
      router.push(destination);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível concluir o onboarding.",
      );
    }
  };

  const finish = () => void complete("/dashboard");

  const startAssessment = () =>
    void complete("/prova?origem=onboarding");

  return (
    <main className="onboarding-page">
      <header>
        <Brand />
        <span>
          {english ? "Step" : "Passo"} {step + 1} {english ? "of" : "de"} {questions.length}
        </span>
        <button disabled={saving} onClick={() => void complete("/dashboard")}>
          {english ? "Skip for now" : "Pular por agora"}
        </button>
      </header>
      <div className="onboarding-progress">
        <i style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
      </div>
      <section className="onboarding-card">
        <div className="question-icon">
          <QuestionIcon />
        </div>
        <span className="question-step">{english ? "QUESTION" : "PERGUNTA"} {step + 1}</span>
        <h1>{english ? translatedQuestion.title : question.title}</h1>
        <p>{english ? translatedQuestion.subtitle : question.subtitle}</p>
        <div className="option-grid">
          {question.options.map(([label, description], optionIndex) => (
            <button
              key={label}
              className={selected === label ? "selected" : ""}
              onClick={() =>
                setAnswers((current) => ({
                  ...current,
                  [question.key]: label,
                }))
              }
            >
              <span className="option-check">
                {selected === label && <Check />}
              </span>
              <div>
                  <b>{english ? translatedQuestion.options[optionIndex][0] : label}</b>
                  <small>{english ? translatedQuestion.options[optionIndex][1] : description}</small>
              </div>
            </button>
          ))}
        </div>
        {step === questions.length - 1 && (
          <div className="onboarding-preferences">
            <label>
              <span>{english ? "App language" : "Idioma do aplicativo"}</span>
              <select
                value={answers.locale}
                onChange={(event) => {
                  const next = event.target.value as "pt-BR" | "en";
                  setLocale(next);
                  setAnswers((current) => ({
                    ...current,
                    locale: next,
                  }));
                }}
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              <span>{english ? "Initial language" : "Linguagem inicial"}</span>
              <select
                value={answers.initialLanguage}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    initialLanguage: event.target.value as "javascript",
                  }))
                }
              >
                <option value="javascript">JavaScript</option>
              </select>
            </label>
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        <div className="onboarding-actions">
          <button
            className="button button-ghost"
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
          >
            <ArrowLeft /> {english ? "Back" : "Voltar"}
          </button>
          {step === questions.length - 1 ? (
            <div className="onboarding-final-actions">
              <button
                type="button"
                className="button button-secondary"
                disabled={!selected || saving}
                onClick={startAssessment}
              >
                <ClipboardCheck /> {english ? "Take placement test" : "Fazer nivelamento"}
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={!selected || saving}
                onClick={finish}
              >
                <Sparkles /> {saving ? (english ? "Saving..." : "Salvando...") : (english ? "Prepare my session" : "Preparar meu treino")}
              </button>
            </div>
          ) : (
            <button
              className="button button-primary"
              disabled={!selected}
              onClick={() => setStep((current) => current + 1)}
            >
              {english ? "Continue" : "Continuar"} <ArrowRight />
            </button>
          )}
        </div>
      </section>
      <p className="onboarding-foot">
        {english ? "Your answers are used only to personalize your path." : "Suas respostas servem apenas para personalizar sua trilha."}
      </p>
    </main>
  );
}
