"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Crown,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAppLocale } from "@/lib/use-app-locale";
import { useAppState } from "@/lib/app-state";
import {
  formatPlanPrice,
  getPlanFeatures,
  PLAN_CATALOG,
} from "@/services/payments/plans";
import type { BillingSubscription } from "@/services/payments/types";

type SubscriptionResponse = { subscription?: BillingSubscription; error?: string };

function useCheckout() {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    if (processing) return;
    setProcessing(true);
    setError("");
    idempotencyKey.current ??= globalThis.crypto.randomUUID();
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-logiclab-request": "same-origin",
          "idempotency-key": idempotencyKey.current,
        },
        body: JSON.stringify({ planId: "premium-monthly" }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (response.status === 401) {
        router.push("/entrar?next=%2Fplanos");
        return;
      }
      if (!response.ok || !payload.url)
        throw new Error(payload.error ?? "Checkout indisponível.");
      window.location.assign(payload.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível abrir o checkout.",
      );
      setProcessing(false);
    }
  };

  return { start, processing, error };
}

export function PlansPage({
  authenticated,
  premiumActive,
}: {
  authenticated: boolean;
  premiumActive: boolean;
}) {
  const { locale } = useAppLocale();
  const english = locale === "en";
  const checkout = useCheckout();
  const free = PLAN_CATALOG.free;
  const premium = PLAN_CATALOG["premium-monthly"];
  return (
    <main className="pricing-page">
      <header className="pricing-header">
        <Brand />
        <div>
          <LanguageSwitcher />
          <Link href={authenticated ? "/dashboard" : "/entrar"}>
            {english ? "Back" : "Voltar"}
          </Link>
        </div>
      </header>
      <section className="pricing-intro">
        <span>{english ? "SIMPLE PLANS" : "PLANOS SIMPLES"}</span>
        <h1>{english ? "Grow at your own pace" : "Evolua no seu ritmo"}</h1>
        <p>
          {english
            ? "Start free and upgrade only when full access makes sense for you."
            : "Comece grátis e assine quando o acesso completo fizer sentido para você."}
        </p>
      </section>
      <section className="pricing-grid" aria-label={english ? "Plans" : "Planos"}>
        <article className="pricing-card panel-card">
          <span className="plan-icon"><ShieldCheck /></span>
          <h2>{free.name}</h2>
          <p>{english ? "To get started." : "Para começar."}</p>
          <strong>{formatPlanPrice(free, locale)}</strong>
          <ul>
            {getPlanFeatures(free, locale).map((feature) => (
              <li key={feature}><CheckCircle2 /> {feature}</li>
            ))}
          </ul>
          {authenticated && !premiumActive ? (
            <Link className="button button-secondary full-button" href="/dashboard">
              {english ? "CURRENT PLAN" : "PLANO ATUAL"}
            </Link>
          ) : !authenticated ? (
            <Link className="button button-secondary full-button" href="/cadastro">
              {english ? "START FREE" : "COMEÇAR GRÁTIS"}
            </Link>
          ) : (
            <span className="button button-secondary full-button" aria-disabled="true">
              {english ? "INCLUDED" : "INCLUÍDO"}
            </span>
          )}
        </article>
        <article className="pricing-card pricing-card-premium">
          <span className="upgrade-kicker"><Crown /> PREMIUM</span>
          <h2>{premium.name}</h2>
          <p>{english ? "For complete access." : "Para quem quer acesso completo."}</p>
          <strong>
            {formatPlanPrice(premium, locale)}
            <small>/{english ? "month" : "mês"}</small>
          </strong>
          <ul>
            {getPlanFeatures(premium, locale).map((feature) => (
              <li key={feature}><CheckCircle2 /> {feature}</li>
            ))}
          </ul>
          <button
            className="button button-primary full-button"
            disabled={checkout.processing || premiumActive}
            onClick={() => void checkout.start()}
          >
            {premiumActive
              ? english ? "CURRENT PLAN" : "PLANO ATUAL"
              : checkout.processing
                ? english ? "OPENING CHECKOUT..." : "ABRINDO CHECKOUT..."
                : <>{english ? "SUBSCRIBE TO PREMIUM" : "ASSINAR PREMIUM"} <ArrowRight /></>}
          </button>
          <small><ShieldCheck /> {english ? "Premium is activated only after provider confirmation." : "O Premium só é ativado após confirmação do provedor."}</small>
          {checkout.error && <div className="auth-error" role="alert">{checkout.error}</div>}
        </article>
      </section>
    </main>
  );
}

export function CheckoutSuccessPage() {
  const { locale } = useAppLocale();
  const { update } = useAppState();
  const english = locale === "en";
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let attempts = 0;
    const poll = async () => {
      try {
        const response = await fetch("/api/billing/subscription", { cache: "no-store" });
        const payload = (await response.json()) as SubscriptionResponse;
        if (!response.ok) throw new Error(payload.error);
        if (!stopped && payload.subscription) setSubscription(payload.subscription);
        setNetworkError(false);
        if (
          !stopped &&
          payload.subscription?.status !== "ACTIVE" &&
          attempts++ < 12
        ) {
          timer = window.setTimeout(poll, 2_500);
        }
      } catch {
        if (!stopped) setNetworkError(true);
        if (!stopped && attempts++ < 12) timer = window.setTimeout(poll, 2_500);
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (subscription?.status !== "ACTIVE") return;
    update((current) => ({
      ...current,
      user: { ...current.user, plan: "pro" },
    }));
  }, [subscription?.status, update]);

  const active = subscription?.status === "ACTIVE";
  const pending = !subscription || ["FREE", "PENDING"].includes(subscription.status);
  return (
    <main className="checkout-result-page">
      <Brand />
      <section className="panel-card" aria-live="polite">
        <span className={active ? "result-icon success" : pending ? "result-icon pending" : "result-icon error"}>
          {active ? <CheckCircle2 /> : pending ? <Clock3 /> : <XCircle />}
        </span>
        <h1>
          {active
            ? english ? "Premium activated" : "Premium ativado"
            : pending
              ? english ? "We're confirming your payment" : "Estamos confirmando seu pagamento"
              : english ? "Payment not confirmed" : "Pagamento não confirmado"}
        </h1>
        <p>
          {active
            ? english ? "Your full access is ready." : "Seu acesso completo está pronto."
            : pending
              ? english ? "We're waiting for the secure confirmation from the payment provider." : "Estamos aguardando a confirmação segura do provedor de pagamento."
              : english ? "Try again from the plans page. No sensitive payment details are shown here." : "Tente novamente pela página de planos. Nenhum detalhe financeiro sensível é exibido aqui."}
        </p>
        {networkError && (
          <small>{english ? "Connection interrupted. We'll keep checking." : "Conexão interrompida. Continuaremos verificando."}</small>
        )}
        <div>
          <Link className="button button-primary" href="/dashboard">
            {english ? "GO TO DASHBOARD" : "IR PARA O DASHBOARD"}
          </Link>
          {!active && (
            <Link className="button button-secondary" href="/planos">
              {english ? "VIEW PLANS" : "VER PLANOS"}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

export function CheckoutCanceledPage() {
  const { locale } = useAppLocale();
  const english = locale === "en";
  return (
    <main className="checkout-result-page">
      <Brand />
      <section className="panel-card">
        <span className="result-icon error"><XCircle /></span>
        <h1>{english ? "Subscription not completed" : "Assinatura não concluída"}</h1>
        <p>{english ? "No charge was confirmed." : "Nenhuma cobrança foi confirmada."}</p>
        <div>
          <Link className="button button-primary" href="/planos">
            {english ? "TRY AGAIN" : "TENTAR NOVAMENTE"}
          </Link>
          <Link className="button button-secondary" href="/dashboard">
            {english ? "CONTINUE ON FREE" : "CONTINUAR NO PLANO GRATUITO"}
          </Link>
        </div>
      </section>
    </main>
  );
}

export function MyPlanPage() {
  const { locale } = useAppLocale();
  const english = locale === "en";
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const premium = PLAN_CATALOG["premium-monthly"];

  useEffect(() => {
    let canceled = false;
    void fetch("/api/billing/subscription", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as SubscriptionResponse;
        if (!response.ok) throw new Error(payload.error);
        if (!canceled) setSubscription(payload.subscription ?? null);
      })
      .catch(() => {
        if (!canceled) setError("subscription-load-failed");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const cancel = async () => {
    if (!window.confirm(english ? "Cancel renewal at the end of the current period?" : "Cancelar a renovação ao fim do período atual?")) return;
    setActionLoading(true);
    setError("");
    try {
      const response = await fetch("/api/billing/subscription", {
        method: "DELETE",
        headers: { "x-logiclab-request": "same-origin" },
      });
      const payload = (await response.json()) as SubscriptionResponse;
      if (!response.ok || !payload.subscription)
        throw new Error(payload.error ?? "Cancelamento indisponível.");
      setSubscription(payload.subscription);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cancelamento indisponível.");
    } finally {
      setActionLoading(false);
    }
  };

  const status = subscription?.status ?? "FREE";
  const hasPremium = status === "ACTIVE" || (status === "CANCELED" && Boolean(subscription?.currentPeriodEnd));
  const end = subscription?.currentPeriodEnd
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(subscription.currentPeriodEnd))
    : null;
  return (
    <div className="standard-page">
      <header className="page-intro">
        <div><span>{english ? "SUBSCRIPTION" : "ASSINATURA"}</span><h1>{english ? "My plan" : "Meu plano"}</h1></div>
      </header>
      <section className="my-plan-card panel-card" aria-busy={loading}>
        <div className="plan-head">
          <span className="plan-icon"><Crown /></span>
          <div>
            <small>{english ? "CURRENT PLAN" : "PLANO ATUAL"}</small>
            <h2>{loading ? "..." : hasPremium ? "Premium" : "Free"}</h2>
          </div>
          <span className={hasPremium ? "status-active" : "status-free"}>{status}</span>
        </div>
        <dl className="plan-details">
          <div><dt>{english ? "Price" : "Valor"}</dt><dd>{hasPremium ? formatPlanPrice(premium, locale) : formatPlanPrice(PLAN_CATALOG.free, locale)}</dd></div>
          <div><dt>{english ? "Cycle" : "Ciclo"}</dt><dd>{hasPremium ? (english ? "Monthly" : "Mensal") : "—"}</dd></div>
          <div><dt>{subscription?.cancelAtPeriodEnd ? (english ? "Access until" : "Acesso até") : (english ? "Next charge" : "Próxima cobrança")}</dt><dd>{end ?? (english ? "Not available" : "Não disponível")}</dd></div>
        </dl>
        {subscription?.cancelAtPeriodEnd && end && (
          <p className="billing-demo-note">
            {english ? `Your subscription is canceled and remains active until ${end}.` : `Sua assinatura foi cancelada e continuará ativa até ${end}.`}
          </p>
        )}
        {status === "PENDING" && <p>{english ? "Payment processing" : "Pagamento em processamento"}</p>}
        {status === "PAST_DUE" && <p>{english ? "We could not confirm the payment." : "Não foi possível confirmar o pagamento."}</p>}
        <div className="plan-actions">
          {status === "ACTIVE" && !subscription?.cancelAtPeriodEnd ? (
            <button className="button button-secondary" disabled={actionLoading} onClick={() => void cancel()}>
              {actionLoading ? (english ? "CANCELING..." : "CANCELANDO...") : (english ? "MANAGE SUBSCRIPTION" : "GERENCIAR ASSINATURA")}
            </button>
          ) : (
            <Link className="button button-primary" href="/planos">
              {hasPremium ? (english ? "REACTIVATE" : "REATIVAR") : (english ? "VIEW PREMIUM" : "VER PREMIUM")}
            </Link>
          )}
        </div>
        {error && (
          <div className="auth-error" role="alert">
            {error === "subscription-load-failed"
              ? english
                ? "Could not load your plan."
                : "Não foi possível carregar seu plano."
              : error}
          </div>
        )}
      </section>
    </div>
  );
}
