"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react";
import { announceAuthChange } from "@/lib/account-storage";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAppLocale } from "@/lib/use-app-locale";

export function ForgotPasswordPage() {
  const { locale } = useAppLocale();
  const english = locale === "en";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [localResetUrl, setLocalResetUrl] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-logiclab-request": "same-origin",
        },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as {
        message?: string;
        localResetUrl?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? "Tente novamente mais tarde.");
      setMessage(
        english
          ? "Request received. If an account exists and delivery is available, you will receive recovery instructions."
          : (payload.message ??
              "Se existir uma conta associada a este e-mail, enviaremos as instruções de recuperação."),
      );
      setLocalResetUrl(payload.localResetUrl ?? "");
    } catch {
      setError(
        english
          ? "We could not process the request. Try again."
          : "Não foi possível processar a solicitação. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="standalone-auth-flow">
      <div className="auth-flow-header">
        <Brand />
        <LanguageSwitcher />
      </div>
      <section className="panel-card">
        <span className="auth-flow-icon">
          <Mail />
        </span>
        <h1>{english ? "Recover your password" : "Recuperar senha"}</h1>
        <p>
          {english
            ? "Enter your email and we'll send a secure recovery link."
            : "Informe seu e-mail e enviaremos um link seguro de recuperação."}
        </p>
        <form onSubmit={submit} aria-busy={loading}>
          <label>
            <span>{english ? "Your email" : "Seu e-mail"}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="button button-primary" disabled={loading}>
            {loading
              ? english
                ? "SENDING..."
                : "ENVIANDO..."
              : english
                ? "SEND RECOVERY LINK"
                : "ENVIAR LINK DE RECUPERAÇÃO"}
          </button>
        </form>
        {message && (
          <div className="inline-success" role="status">
            <CheckCircle2 /> {message}
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        {localResetUrl &&
          /^\/redefinir-senha\?token=[A-Za-z0-9_-]+$/.test(localResetUrl) && (
            <div>
              <p>Somente desenvolvimento: nenhum e-mail foi enviado.</p>
              <Link className="button button-secondary" href={localResetUrl}>
                {english
                  ? "Open local development link"
                  : "Abrir link local de desenvolvimento"}
              </Link>
            </div>
          )}
        <Link href="/entrar" className="auth-flow-back">
          <ArrowLeft /> {english ? "Back to sign in" : "Voltar ao login"}
        </Link>
      </section>
    </main>
  );
}

export function ResetPasswordPage({ token }: { token: string }) {
  const { locale } = useAppLocale();
  const english = locale === "en";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (password !== confirmation) {
      setError(
        english ? "Passwords do not match." : "As senhas não coincidem.",
      );
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-logiclab-request": "same-origin",
        },
        body: JSON.stringify({
          token,
          password,
          passwordConfirmation: confirmation,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Não foi possível redefinir a senha.");
      announceAuthChange();
      setMessage(
        english
          ? "Password changed. Previous sessions were closed."
          : "Senha alterada. As sessões anteriores foram encerradas.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : english
            ? "We could not save the new password."
            : "Não foi possível salvar a nova senha.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="standalone-auth-flow">
      <div className="auth-flow-header">
        <Brand />
        <LanguageSwitcher />
      </div>
      <section className="panel-card">
        <span className="auth-flow-icon">
          <KeyRound />
        </span>
        <h1>{english ? "Create a new password" : "Criar nova senha"}</h1>
        {!token ? (
          <div className="auth-error">
            {english
              ? "This recovery link is invalid."
              : "Este link de recuperação é inválido."}
          </div>
        ) : message ? (
          <>
            <div className="inline-success">
              <CheckCircle2 /> {message}
            </div>
            <Link href="/entrar" className="button button-primary">
              {english
                ? "SIGN IN WITH THE NEW PASSWORD"
                : "ENTRAR COM A NOVA SENHA"}
            </Link>
          </>
        ) : (
          <form onSubmit={submit} aria-busy={loading}>
            <label>
              <span>{english ? "New password" : "Nova senha"}</span>
              <input
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              <span>
                {english ? "Confirm new password" : "Confirmar nova senha"}
              </span>
              <input
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <small className="password-requirements">
              {english
                ? "Use 10–128 characters with at least one letter and one number."
                : "Use de 10 a 128 caracteres, com pelo menos uma letra e um número."}
            </small>
            <button className="button button-primary" disabled={loading}>
              {loading
                ? english
                  ? "SAVING..."
                  : "SALVANDO..."
                : english
                  ? "SAVE NEW PASSWORD"
                  : "SALVAR NOVA SENHA"}
            </button>
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
