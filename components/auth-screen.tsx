"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  announceAuthChange,
  clearSessionPresentation,
} from "@/lib/account-storage";
import { useAppLocale } from "@/lib/use-app-locale";
import { rememberAuthDelivery } from "@/lib/auth-delivery";
import type { AuthEmailDelivery } from "@/services/email/auth-email";

type PublicAccount = {
  id: string;
  emailVerifiedAt?: string | null;
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN";
  plan: "FREE" | "PRO";
  onboardingCompleted?: boolean;
  locale?: "pt-BR" | "en";
  initialLanguage?: "javascript";
};

function safeReturnPath(value: string | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/dashboard";
  if (
    /^\/(entrar|login|cadastro|recuperar-senha|redefinir-senha)(\/|\?|$)/.test(
      value,
    )
  )
    return "/dashboard";
  return value;
}

export function AuthScreen({
  mode,
  nextPath,
}: {
  mode: "login" | "signup";
  nextPath?: string;
}) {
  const { locale } = useAppLocale();
  const english = locale === "en";
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      if (mode === "signup" && password !== confirmation) {
        throw new Error(
          english ? "Passwords do not match." : "As senhas não coincidem.",
        );
      }
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch(
        mode === "signup" ? "/api/auth/signup" : "/api/auth/login",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-logiclab-request": "same-origin",
          },
          body: JSON.stringify({
            name,
            username,
            passwordConfirmation: confirmation,
            email: normalizedEmail,
            password,
            acceptedTerms,
          }),
        },
      );
      const payload = (await response.json()) as {
        account?: PublicAccount;
        error?: string;
        delivery?: AuthEmailDelivery;
      };
      if (!response.ok || !payload.account) {
        throw new Error(
          payload.error ??
            (english
              ? "We could not sign you in. Check your details and try again."
              : "Não foi possível entrar. Verifique seus dados e tente novamente."),
        );
      }
      const account = payload.account;
      clearSessionPresentation();
      if (payload.delivery) rememberAuthDelivery(account.id, payload.delivery);
      announceAuthChange();
      setMessage(
        english
          ? "All set. Opening your workspace..."
          : "Tudo certo. Entrando no seu espaço...",
      );
      window.location.assign(
        !account.emailVerifiedAt
          ? "/confirmar-email"
          : !account.onboardingCompleted
            ? "/onboarding"
            : safeReturnPath(nextPath),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : english
            ? "We could not complete your access."
            : "Não foi possível concluir o acesso.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="LogicLab">
        <Brand />
        <div>
          <span className="auth-kicker">
            {english ? "PRACTICE THAT TRANSFORMS" : "PRÁTICA QUE TRANSFORMA"}
          </span>
          <h1>
            {english ? "Build the confidence to" : "Construa a confiança de"}
            <br />
            <em>
              {english ? "solve it yourself." : "resolver por conta própria."}
            </em>
          </h1>
          <p>
            {english
              ? "Short sessions, clear feedback and a path forward every day."
              : "Treinos curtos, correção didática e um caminho claro todos os dias."}
          </p>
          <ul>
            <li>
              <CheckCircle2 />{" "}
              {english
                ? "20–30 minute daily practice"
                : "Prática diária de 20–30 minutos"}
            </li>
            <li>
              <CheckCircle2 />{" "}
              {english
                ? "Progress saved automatically"
                : "Progresso salvo automaticamente"}
            </li>
            <li>
              <CheckCircle2 />{" "}
              {english
                ? "Feedback that explains your reasoning"
                : "Feedback que explica seu raciocínio"}
            </li>
          </ul>
        </div>
        <small>© 2026 LogicLab</small>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-toolbar">
            <LanguageSwitcher />
          </div>
          <h2>
            {mode === "login"
              ? english
                ? "Welcome back"
                : "Bem-vindo de volta"
              : english
                ? "Start practicing programming"
                : "Comece a praticar programação"}
          </h2>
          <p>
            {mode === "login"
              ? english
                ? "Continue your programming journey."
                : "Continue sua evolução em programação."
              : english
                ? "Create your free account."
                : "Crie sua conta gratuita."}
          </p>

          <form onSubmit={submit} aria-busy={loading}>
            {mode === "signup" && (
              <label>
                <span>Username</span>
                <div className="input-shell">
                  <UserRound />
                  <input
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z][A-Za-z0-9_]{2,31}"
                    autoComplete="username"
                    aria-label="Username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="seu_username"
                  />
                </div>
                <small>
                  De 3 a 32 caracteres: letras, números e _. Comece com uma
                  letra.
                </small>
              </label>
            )}
            {mode === "signup" && (
              <label>
                <span>{english ? "Name" : "Nome"}</span>
                <div className="input-shell">
                  <UserRound />
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={
                      english
                        ? "What should we call you?"
                        : "Como podemos chamar você?"
                    }
                  />
                </div>
              </label>
            )}
            <label>
              <span>{english ? "Email" : "E-mail"}</span>
              <div className="input-shell">
                <Mail />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@email.com"
                />
              </div>
            </label>
            <div className="auth-password-field">
              <label htmlFor={`${mode}-password`}>
                <span>{english ? "Password" : "Senha"}</span>
              </label>
              <div className="input-shell">
                <LockKeyhole />
                <input
                  id={`${mode}-password`}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={10}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    english
                      ? "Show or hide password"
                      : "Mostrar ou ocultar senha"
                  }
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <>
                <div className="auth-password-field">
                  <label htmlFor="signup-password-confirmation">
                    <span>
                      {english ? "Confirm password" : "Confirmar senha"}
                    </span>
                  </label>
                  <div className="input-shell">
                    <LockKeyhole />
                    <input
                      id="signup-password-confirmation"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={10}
                      maxLength={128}
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <small className="password-requirements">
                  {english
                    ? "Use 10–128 characters with at least one letter and one number."
                    : "Use de 10 a 128 caracteres, com pelo menos uma letra e um número."}
                </small>
                <label className="terms-checkbox">
                  <input
                    type="checkbox"
                    required
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                  />
                  <span>
                    {english ? "I accept the " : "Li e aceito os "}
                    <Link href="/termos">
                      {english ? "Terms" : "Termos de Uso"}
                    </Link>{" "}
                    {english ? "and the " : "e a "}
                    <Link href="/privacidade">
                      {english ? "Privacy Policy" : "Política de Privacidade"}
                    </Link>
                    .
                  </span>
                </label>
              </>
            )}

            {mode === "login" && (
              <div className="form-between auth-recovery-link">
                <span>
                  {english
                    ? "Secure persistent session"
                    : "Sessão segura e persistente"}
                </span>
                <Link href="/recuperar-senha">
                  {english ? "Forgot my password" : "Esqueci minha senha"}
                </Link>
              </div>
            )}

            <button
              className="button button-primary full-button"
              disabled={loading}
            >
              {loading ? (
                mode === "login" ? (
                  english ? (
                    "SIGNING IN..."
                  ) : (
                    "ENTRANDO..."
                  )
                ) : english ? (
                  "CREATING ACCOUNT..."
                ) : (
                  "CRIANDO CONTA..."
                )
              ) : (
                <>
                  {mode === "login"
                    ? english
                      ? "SIGN IN"
                      : "ENTRAR"
                    : english
                      ? "CREATE ACCOUNT"
                      : "CRIAR CONTA"}{" "}
                  <ArrowRight />
                </>
              )}
            </button>
            {message && (
              <div className="auth-success" role="status">
                <CheckCircle2 /> {message}
              </div>
            )}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
          </form>

          <div className="auth-switch">
            {mode === "login"
              ? english
                ? "Don't have an account?"
                : "Ainda não tem conta?"
              : english
                ? "Already have an account?"
                : "Já tem conta?"}{" "}
            <Link href={mode === "login" ? "/cadastro" : "/entrar"}>
              {mode === "login"
                ? english
                  ? "CREATE ACCOUNT"
                  : "CRIAR CONTA"
                : english
                  ? "SIGN IN"
                  : "ENTRAR"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
