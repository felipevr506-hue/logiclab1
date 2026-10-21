"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import {
  announceAuthChange,
  clearSessionPresentation,
} from "@/lib/account-storage";
import { readAuthDelivery, rememberAuthDelivery } from "@/lib/auth-delivery";
import type { AuthEmailDelivery } from "@/services/email/auth-email";
import type { EmailVerificationResult } from "@/services/auth/verification-policy";

const headers = {
  "content-type": "application/json",
  "x-logiclab-request": "same-origin",
};

function DeliveryNotice({ delivery }: { delivery: AuthEmailDelivery | null }) {
  if (!delivery)
    return (
      <p>
        Confirme seu e-mail para liberar o acesso às aulas. Confira também a
        pasta de spam.
      </p>
    );
  if (
    delivery.status === "failed" ||
    (delivery.status === "development" && process.env.NODE_ENV === "production")
  )
    return (
      <p role="alert">
        Sua conta está salva, mas não foi possível enviar a confirmação. Tente
        reenviar mais tarde.
      </p>
    );
  if (
    delivery.status === "development" &&
    process.env.NODE_ENV !== "production"
  )
    return (
      <div role="status">
        <p>
          <strong>Somente desenvolvimento: nenhum e-mail foi enviado.</strong> O
          link local abaixo não é disponibilizado em produção.
        </p>
        {delivery.localUrl &&
          /^\/verificar-email\?token=[A-Za-z0-9_-]+$/.test(
            delivery.localUrl,
          ) && (
            <Link className="button button-secondary" href={delivery.localUrl}>
              Abrir confirmação local de desenvolvimento
            </Link>
          )}
      </div>
    );
  return (
    <p role="status">
      O provedor aceitou o envio da confirmação. Confira sua caixa de entrada e
      a pasta de spam.
    </p>
  );
}

export function ConfirmEmailFlow({
  account,
}: {
  account: { id: string; email: string; username: string };
}) {
  const [delivery, setDelivery] = useState<AuthEmailDelivery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readAuthDelivery(account.id);
      if (stored) setDelivery(stored);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [account.id]);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [remaining]);
  const resend = async () => {
    if (busy || remaining) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers,
      });
      const payload = (await response.json()) as {
        delivery?: AuthEmailDelivery;
        error?: string;
        status?: string;
      };
      if (payload.status === "already_verified") {
        window.location.assign(new URL("/onboarding", window.location.origin));
        return;
      }
      if (payload.delivery) {
        rememberAuthDelivery(account.id, payload.delivery);
        setDelivery(payload.delivery);
      }
      if (!response.ok) {
        setRemaining(Number(response.headers.get("Retry-After")) || 0);
        if (!payload.delivery)
          throw new Error(payload.error ?? "Não foi possível reenviar.");
      } else setRemaining(60);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Tente novamente mais tarde.",
      );
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers,
    });
    if (!response.ok) {
      setError("Não foi possível encerrar a sessão.");
      return;
    }
    clearSessionPresentation();
    announceAuthChange();
    window.location.assign(window.location.origin);
  };
  return (
    <main className="standalone-auth-flow">
      <div className="auth-flow-header">
        <Brand />
      </div>
      <section className="panel-card">
        <h1>Confirme seu e-mail</h1>
        <p>
          Conta <strong>@{account.username}</strong> criada. Confirme o endereço{" "}
          <strong>{account.email}</strong> para continuar.
        </p>
        <DeliveryNotice delivery={delivery} />
        <button
          className="button button-primary"
          disabled={busy || remaining > 0}
          onClick={() => void resend()}
        >
          {remaining
            ? `Reenviar em ${remaining}s`
            : busy
              ? "Reenviando…"
              : "Reenviar confirmação"}
        </button>
        {error && <p role="alert">{error}</p>}
        <p>
          <button
            className="button button-secondary"
            onClick={() => window.location.reload()}
          >
            Já confirmei meu e-mail
          </button>
        </p>
        <button
          className="button button-secondary"
          onClick={() => void logout()}
        >
          Sair desta conta
        </button>
      </section>
    </main>
  );
}

const messages: Record<EmailVerificationResult, string> = {
  verified: "E-mail confirmado. Você já pode entrar na sua conta.",
  already_verified: "Este e-mail já foi confirmado. Entre para continuar.",
  expired:
    "Este link expirou ou foi substituído por um reenvio. Solicite uma nova confirmação.",
  used: "Este link já foi utilizado. Se a conta ainda pedir confirmação, solicite um novo link.",
  invalid: "Este link de confirmação é inválido. Solicite um novo link.",
};
export function VerifyEmailFlow({ token }: { token: string }) {
  const [status, setStatus] = useState<EmailVerificationResult | null>(
    token ? null : "invalid",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json()) as {
        status?: EmailVerificationResult;
        error?: string;
      };
      if (!payload.status)
        throw new Error(payload.error ?? "Não foi possível confirmar agora.");
      setStatus(payload.status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="standalone-auth-flow">
      <div className="auth-flow-header">
        <Brand />
      </div>
      <section className="panel-card">
        <h1>Verificação de e-mail</h1>
        {status ? (
          <p role="status">{messages[status]}</p>
        ) : (
          <>
            <p>Confirme que deseja verificar o e-mail da sua conta LogicLab.</p>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void verify()}
            >
              {busy ? "Confirmando…" : "Confirmar meu e-mail"}
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <p>
          <Link href="/entrar">Entrar na minha conta</Link>
        </p>
        {(status === "verified" || status === "already_verified") && (
          <p>
            <a className="button button-primary" href="/confirmar-email">
              Continuar para o aplicativo
            </a>
          </p>
        )}
        <Link href="/confirmar-email">Solicitar nova confirmação</Link>
      </section>
    </main>
  );
}
