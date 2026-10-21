"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleUserRound,
  Cloud,
  CloudOff,
  Flame,
  LoaderCircle,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { useAppState } from "@/lib/app-state";
import { getUserDailyWorkout } from "@/lib/daily-workouts";
import { StudentNavigation } from "@/components/student-navigation";
import styles from "./app-shell.module.css";

const titles: Record<string, string> = {
  "/dashboard": "Início",
  "/trilha": "Minha trilha",
  "/linguagens": "Linguagens",
  "/habilidades": "Minhas habilidades",
  "/recompensas": "Minhas recompensas",
  "/praticar": "Praticar",
  "/laboratorio": "Laboratório",
  "/playground": "Playground livre",
  "/missoes": "Missões",
  "/projetos": "Projetos",
  "/portfolio": "Meu portfólio",
  "/evolucao": "Meu progresso",
  "/relatorio": "Relatório semanal",
  "/prova": "Testar habilidades",
  "/revisar": "Revisar",
  "/caderno": "Meu caderno",
  "/atividade": "Minha atividade",
  "/glossario": "Glossário",
  "/buscar": "Busca global",
  "/perfil": "Meu perfil",
  "/seguranca": "Conta e segurança",
  "/assinatura": "Assinatura",
  "/ajuda": "Central de ajuda",
  "/admin": "Painel administrativo",
};

const SIDEBAR_SCROLL_STORAGE_KEY = "logiclab:sidebar-scroll-top";
let sidebarScrollTop: number | null = null;

function readSidebarScrollTop() {
  if (sidebarScrollTop !== null) return sidebarScrollTop;
  try {
    const stored = Number(sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY));
    sidebarScrollTop = Number.isFinite(stored) && stored >= 0 ? stored : 0;
  } catch {
    sidebarScrollTop = 0;
  }
  return sidebarScrollTop;
}

function rememberSidebarScroll(nav: HTMLElement | null) {
  if (!nav) return;
  sidebarScrollTop = nav.scrollTop;
  try {
    sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(nav.scrollTop));
  } catch {
    // The in-memory value still preserves the position during this session.
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { state, update, syncIndicator, endSession } = useAppState();
  const currentWorkout = getUserDailyWorkout(state.user.trainingStartedOn);
  const title = pathname.startsWith("/treino/")
    ? "Treino do dia"
    : (titles[pathname] ?? "LogicLab");
  const initials = state.user.name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      sidebar.querySelector<HTMLButtonElement>(".mobile-close")?.focus(),
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), summary",
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const media = window.matchMedia("(max-width: 1360px)");
    const onResize = () => {
      if (!media.matches) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    media.addEventListener("change", onResize);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      media.removeEventListener("change", onResize);
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  useLayoutEffect(() => {
    const navElement = sidebarNavRef.current;
    if (!navElement) return;

    const storedPosition = readSidebarScrollTop();
    if (storedPosition > 0) {
      navElement.scrollTop = storedPosition;
    } else {
      const activeLink = navElement.querySelector<HTMLElement>("a.active");
      if (activeLink) {
        const centeredPosition =
          activeLink.offsetTop -
          navElement.clientHeight / 2 +
          activeLink.clientHeight / 2;
        navElement.scrollTop = Math.max(0, centeredPosition);
        rememberSidebarScroll(navElement);
      }
    }

    const frame = requestAnimationFrame(() => {
      if (navElement.isConnected) navElement.scrollTop = readSidebarScrollTop();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div className="app-frame">
      {menuOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside
        ref={sidebarRef}
        id="student-sidebar"
        className={`app-sidebar ${styles.sidebar} ${menuOpen ? `sidebar-open ${styles.open}` : ""}`}
        aria-label="Menu do aluno"
      >
        <div className="sidebar-brand">
          <Brand href="/" />
          <button
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X />
          </button>
        </div>
        <StudentNavigation
          pathname={pathname}
          workoutHref={`/treino/${currentWorkout.exerciseId}`}
          isAdmin={state.user.role === "admin"}
          navRef={sidebarNavRef}
          onScroll={rememberSidebarScroll}
          onNavigate={() => {
            rememberSidebarScroll(sidebarNavRef.current);
            setMenuOpen(false);
          }}
        />
        <Link href="/perfil" className="sidebar-user">
          <span
            className={`avatar ${state.user.avatar ? "has-image" : ""}`}
            style={
              state.user.avatar
                ? { backgroundImage: `url(${state.user.avatar})` }
                : undefined
            }
          >
            {!state.user.avatar &&
              (initials || <CircleUserRound aria-hidden="true" />)}
          </span>
          <div>
            <b>{state.user.name || "Minha conta"}</b>
            <small>
              {state.user.plan === "pro" ? "Plano Pro" : "Plano gratuito"}
            </small>
          </div>
          <Settings />
        </Link>
        <button
          type="button"
          className="sidebar-logout"
          onClick={async () => {
            const response = await fetch("/api/auth/logout", {
              method: "POST",
              headers: { "x-logiclab-request": "same-origin" },
            });
            if (!response.ok)
              throw new Error("Não foi possível encerrar a sessão.");
            sidebarScrollTop = null;
            try {
              sessionStorage.removeItem(SIDEBAR_SCROLL_STORAGE_KEY);
            } catch {}
            endSession();
            // Discard server-rendered account permissions along with client state.
            window.location.assign(window.location.origin);
          }}
          aria-label="Sair da conta"
        >
          <LogOut /> Sair
        </button>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div>
            <button
              ref={menuButtonRef}
              className="topbar-menu"
              aria-expanded={menuOpen}
              aria-controls="student-sidebar"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </button>
            <span>LogicLab</span>
            <ChevronRight />
            <b>{title}</b>
          </div>
          <div className="topbar-actions">
            <span
              className={`sync-chip sync-${syncIndicator.status}`}
              title={syncIndicator.message}
              role="status"
            >
              {syncIndicator.status === "saving" ? (
                <LoaderCircle />
              ) : syncIndicator.status === "offline" ||
                syncIndicator.status === "error" ? (
                <CloudOff />
              ) : (
                <Cloud />
              )}
              <span className="sync-label">
                {syncIndicator.status === "saving"
                  ? "Salvando..."
                  : syncIndicator.status === "saved"
                    ? "Salvo"
                    : syncIndicator.status === "conflict"
                      ? "Versões preservadas"
                      : syncIndicator.status === "offline"
                        ? "Offline"
                        : syncIndicator.status === "error"
                          ? "Falha ao sincronizar"
                          : "Backup local"}
              </span>
            </span>
            {pathname !== "/dashboard" && (
              <>
                <span className="xp-chip">
                  <Trophy /> {state.xp} XP
                </span>
                <span className="streak-chip">
                  <Flame /> {state.streak}
                </span>
              </>
            )}
            <Link
              href="/buscar"
              className="icon-button"
              aria-label="Abrir busca global"
              title="Busca global"
            >
              <Search />
            </Link>
            <button
              className="icon-button"
              aria-label={
                state.theme === "dark"
                  ? "Ativar tema claro"
                  : "Ativar tema escuro"
              }
              onClick={() =>
                update({ theme: state.theme === "dark" ? "light" : "dark" })
              }
            >
              {state.theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notificações"
              aria-expanded={notificationsOpen}
              aria-controls="notifications-panel"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell />
              {!state.notificationsReadAt &&
                Object.values(state.notificationPreferences).some(Boolean) && (
                  <i />
                )}
            </button>
            {notificationsOpen && (
              <div
                id="notifications-panel"
                className="notifications-panel"
                role="region"
                aria-label="Central de notificações"
              >
                {state.notificationPreferences.dailyTraining ? (
                  <div>
                    <Bell />
                    <span>
                      <b>Treino {currentWorkout.day} está pronto</b>
                      <small>
                        {currentWorkout.shortTitle} em cerca de{" "}
                        {currentWorkout.duration} minutos.
                      </small>
                    </span>
                  </div>
                ) : (
                  <div>
                    <Bell />
                    <span>
                      <b>Sem novos avisos</b>
                      <small>
                        Você pode ajustar as preferências no perfil.
                      </small>
                    </span>
                  </div>
                )}
                <Link
                  href={`/treino/${currentWorkout.exerciseId}`}
                  onClick={() => setNotificationsOpen(false)}
                >
                  Começar treino <ChevronRight />
                </Link>
                {!state.notificationsReadAt && (
                  <button
                    type="button"
                    className="notifications-read-all"
                    onClick={() =>
                      update({ notificationsReadAt: new Date().toISOString() })
                    }
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>
            )}
          </div>
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
