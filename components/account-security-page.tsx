"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  KeyRound,
  Laptop,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { rememberAuthDelivery } from "@/lib/auth-delivery";
import type { AuthEmailDelivery } from "@/services/email/auth-email";
import { PageIntro } from "@/components/ui";
import {
  announceAuthChange,
  clearSessionPresentation,
} from "@/lib/account-storage";

type SessionView = {
  id: string;
  device: string;
  current: boolean;
  lastSeenAt: string;
  expiresAt: string;
};

const requestHeaders = {
  "content-type": "application/json",
  "x-logiclab-request": "same-origin",
};

export function AccountSecurityPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [exportPassword, setExportPassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/auth/sessions", { cache: "no-store" });
    if (!response.ok) {
      setAuthenticated(false);
      return;
    }
    const payload = (await response.json()) as { sessions: SessionView[] };
    setSessions(payload.sessions);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" }).then(async (meResponse) => {
      const identity = (await meResponse.json()) as {
        account: unknown | null;
      };
      if (!active) return;
      if (!identity.account) {
        setAuthenticated(false);
        return;
      }
      const response = await fetch("/api/auth/sessions", {
        cache: "no-store",
      });
      if (!active) return;
      if (!response.ok) {
        setAuthenticated(false);
        return;
      }
      const payload = (await response.json()) as { sessions: SessionView[] };
      if (!active) return;
      setSessions(payload.sessions);
      setAuthenticated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: requestHeaders,
      body: JSON.stringify({
        action: "password",
        currentPassword,
        password: newPassword,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok)
      return setError(payload.error ?? "Falha ao alterar senha.");
    setCurrentPassword("");
    setNewPassword("");
    setNotice("Senha alterada com segurança.");
  };

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/account", {
      method: "PATCH",
      headers: requestHeaders,
      body: JSON.stringify({
        action: "email",
        email,
        currentPassword: emailPassword,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      accountId?: string;
      delivery?: AuthEmailDelivery;
    };
    if (!response.ok)
      return setError(payload.error ?? "Falha ao alterar e-mail.");
    clearSessionPresentation();
    if (payload.accountId && payload.delivery)
      rememberAuthDelivery(payload.accountId, payload.delivery);
    announceAuthChange();
    window.location.assign(new URL("/confirmar-email", window.location.origin));
  };

  const exportData = async () => {
    setError("");
    const response = await fetch("/api/auth/account", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ action: "export", password: exportPassword }),
      cache: "no-store",
    });
    if (!response.ok)
      return setError("Entre novamente para exportar seus dados.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "logiclab-dados.json";
    link.click();
    URL.revokeObjectURL(url);
    setExportPassword("");
    setNotice("Exportação preparada sem incluir senhas ou tokens.");
  };

  const deleteCurrentAccount = async () => {
    setError("");
    const response = await fetch("/api/auth/account", {
      method: "DELETE",
      headers: requestHeaders,
      body: JSON.stringify({
        confirmation: deleteConfirmation,
        password: deletePassword,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok)
      return setError(payload.error ?? "Falha ao excluir conta.");
    clearSessionPresentation();
    announceAuthChange();
    window.location.assign(window.location.origin);
  };

  return (
    <div className="standard-page account-security-page">
      <PageIntro
        eyebrow="CONTA E SEGURANÇA"
        title="Proteja seu acesso."
        text="Gerencie senha, e-mail, dispositivos e seus direitos sobre os dados."
      />

      {authenticated === false && (
        <section className="security-demo-note panel-card">
          <ShieldCheck />
          <div>
            <h2>Você está usando o perfil demonstrativo</h2>
            <p>
              Crie uma conta ou entre pelo fluxo seguro para gerenciar sessões,
              alterar senha, exportar dados e excluir a conta.
            </p>
            <button
              className="button button-primary"
              onClick={() => router.push("/cadastro")}
            >
              Criar conta segura
            </button>
          </div>
        </section>
      )}

      {authenticated && (
        <div className="security-grid">
          <section className="panel-card security-sessions">
            <header>
              <Laptop />
              <div>
                <h2>Seus dispositivos</h2>
                <p>
                  Mostramos somente navegador e sistema, sem localização exata.
                </p>
              </div>
            </header>
            {sessions.map((session) => (
              <article key={session.id}>
                <Laptop />
                <div>
                  <b>{session.device}</b>
                  <small>
                    {session.current
                      ? "Ativo agora"
                      : `Último uso em ${new Date(session.lastSeenAt).toLocaleDateString("pt-BR")}`}
                  </small>
                </div>
                {session.current && <span>ESTE DISPOSITIVO</span>}
              </article>
            ))}
            <button
              className="button button-secondary"
              onClick={async () => {
                await fetch("/api/auth/sessions", {
                  method: "DELETE",
                  headers: { "x-logiclab-request": "same-origin" },
                });
                await loadSessions();
                setNotice("Outros dispositivos foram desconectados.");
              }}
            >
              <LogOut /> Sair de outros dispositivos
            </button>
          </section>

          <form className="panel-card security-form" onSubmit={submitPassword}>
            <header>
              <KeyRound />
              <div>
                <h2>Alterar senha</h2>
                <p>Use ao menos 10 caracteres, uma letra e um número.</p>
              </div>
            </header>
            <label>
              <span>Senha atual</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              <span>Nova senha</span>
              <input
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <button className="button button-primary">Atualizar senha</button>
          </form>

          <form className="panel-card security-form" onSubmit={submitEmail}>
            <header>
              <Mail />
              <div>
                <h2>Alterar e-mail</h2>
                <p>O novo endereço precisará ser verificado.</p>
              </div>
            </header>
            <label>
              <span>Novo e-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Senha atual</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
              />
            </label>
            <button className="button button-primary">Alterar e-mail</button>
          </form>

          <section className="panel-card security-data">
            <header>
              <Download />
              <div>
                <h2>Seus dados</h2>
                <p>Baixe perfil, sessões sem tokens e progresso associado.</p>
              </div>
            </header>
            <label>
              <span>Confirme sua senha atual</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={exportPassword}
                onChange={(event) => setExportPassword(event.target.value)}
              />
            </label>
            <button
              className="button button-secondary"
              disabled={!exportPassword}
              onClick={exportData}
            >
              <Download /> Exportar meus dados
            </button>
          </section>

          <section className="panel-card security-delete">
            <header>
              <Trash2 />
              <div>
                <h2>Excluir minha conta</h2>
                <p>
                  Esta ação remove conta, sessões e progresso do servidor local.
                  Ela não pode ser desfeita.
                </p>
              </div>
            </header>
            <label>
              <span>Digite EXCLUIR MINHA CONTA</span>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
            </label>
            <label>
              <span>Confirme sua senha</span>
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </label>
            <button
              className="button danger-button"
              disabled={
                deleteConfirmation !== "EXCLUIR MINHA CONTA" || !deletePassword
              }
              onClick={deleteCurrentAccount}
            >
              Excluir permanentemente
            </button>
          </section>
        </div>
      )}

      {notice && (
        <div className="inline-success security-toast" role="status">
          <CheckCircle2 /> {notice}
        </div>
      )}
      {error && (
        <div className="auth-error security-toast" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
