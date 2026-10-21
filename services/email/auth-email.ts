import "server-only";

import { allowsLocalDevelopmentFeatures } from "@/services/security/environment";

export type AuthEmailDelivery = {
  status: "sent" | "development" | "failed";
  delivered: boolean;
  local: boolean;
  localUrl?: string;
};
export function developmentEmailEnabled() {
  return (
    allowsLocalDevelopmentFeatures() && process.env.NODE_ENV !== "production"
  );
}
export function publicEmailDelivery(
  delivery: AuthEmailDelivery,
  hostname: string,
) {
  const local =
    delivery.local &&
    developmentEmailEnabled() &&
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  return {
    status: delivery.status,
    delivered: delivery.delivered,
    local,
    ...(local && delivery.localUrl ? { localUrl: delivery.localUrl } : {}),
  };
}

type AuthEmailInput = {
  to: string;
  kind: "verify" | "reset";
  token: string;
};

function applicationUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) throw new Error("NEXT_PUBLIC_APP_URL não configurada.");
  const url = new URL(configured);
  if (
    url.protocol !== "https:" &&
    !(
      developmentEmailEnabled() &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  ) {
    throw new Error("NEXT_PUBLIC_APP_URL deve usar HTTPS fora do localhost.");
  }
  return url;
}

async function deliverAuthEmail(
  input: AuthEmailInput,
): Promise<AuthEmailDelivery> {
  const mode = process.env.AUTH_EMAIL_DELIVERY?.trim().toLowerCase();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (
    developmentEmailEnabled() &&
    !apiKey &&
    (!mode || mode === "console" || mode === "development" || mode === "resend")
  ) {
    const path =
      input.kind === "verify" ? "/verificar-email" : "/redefinir-senha";
    return {
      status: "development",
      delivered: false,
      local: true,
      localUrl: path + "?token=" + encodeURIComponent(input.token),
    };
  }
  // Configured credentials always use Resend, even with a stale local mode.
  if (mode && !["resend", "console", "development"].includes(mode))
    throw new Error("Email provider is not configured.");
  if (!apiKey || !from) {
    throw new Error(
      "AUTH_EMAIL_DELIVERY=resend exige RESEND_API_KEY e AUTH_EMAIL_FROM.",
    );
  }

  const base = applicationUrl();
  const path =
    input.kind === "verify" ? "/verificar-email" : "/redefinir-senha";
  const action = new URL(path, base);
  action.searchParams.set("token", input.token);
  const reset = input.kind === "reset";
  const subject = reset
    ? "Redefina sua senha do LogicLab"
    : "Confirme seu e-mail no LogicLab";
  const intro = reset
    ? "Recebemos uma solicitação para redefinir sua senha."
    : "Confirme seu e-mail para concluir a configuração da sua conta.";
  const label = reset ? "Criar nova senha" : "Confirmar e-mail";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      text: `${intro}\n\n${label}: ${action.toString()}\n\nSe você não solicitou isso, ignore esta mensagem.`,
      html: `<p>${intro}</p><p><a href="${action.toString()}">${label}</a></p><p>Se você não solicitou isso, ignore esta mensagem.</p>`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `O provedor de e-mail respondeu com status ${response.status}.`,
    );
  }
  const receipt = (await response.json()) as { id?: unknown };
  if (typeof receipt.id !== "string" || !receipt.id)
    throw new Error("Missing provider receipt.");
  return { status: "sent", delivered: true, local: false };
}

export async function sendAuthEmail(
  input: AuthEmailInput,
): Promise<AuthEmailDelivery> {
  try {
    return await deliverAuthEmail(input);
  } catch {
    console.error("Auth email: provider did not accept delivery.");
    return { status: "failed", delivered: false, local: false };
  }
}
