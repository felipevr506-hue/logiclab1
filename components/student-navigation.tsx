"use client";

import Link from "next/link";
import type { RefObject } from "react";
import {
  LayoutDashboard,
  Route,
  Dumbbell,
  TrendingUp,
  Languages,
  BrainCircuit,
  Gift,
  FlaskConical,
  Braces,
  Flag,
  FolderKanban,
  BriefcaseBusiness,
  BarChart3,
  ClipboardCheck,
  RefreshCcw,
  NotebookTabs,
  History,
  BookType,
  BookOpen,
  CircleUserRound,
  ShieldCheck,
  CreditCard,
  HelpCircle,
  Shield,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import styles from "./student-navigation.module.css";

type Item = { href: string; label: string; icon: LucideIcon };
const primary: Item[] = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/trilha", label: "Minha trilha", icon: Route },
  { href: "/praticar", label: "Praticar", icon: Dumbbell },
  { href: "/evolucao", label: "Meu progresso", icon: TrendingUp },
];
const advanced: Item[] = [
  { href: "/linguagens", label: "Linguagens", icon: Languages },
  { href: "/habilidades", label: "Minhas habilidades", icon: BrainCircuit },
  { href: "/recompensas", label: "Recompensas", icon: Gift },
  { href: "/laboratorio", label: "Laboratório", icon: FlaskConical },
  { href: "/playground", label: "Playground", icon: Braces },
  { href: "/missoes", label: "Missões", icon: Flag },
  { href: "/projetos", label: "Projetos", icon: FolderKanban },
  { href: "/portfolio", label: "Meu portfólio", icon: BriefcaseBusiness },
  { href: "/relatorio", label: "Relatório semanal", icon: BarChart3 },
  { href: "/prova", label: "Testar habilidades", icon: ClipboardCheck },
  { href: "/revisar", label: "Revisar", icon: RefreshCcw },
  { href: "/caderno", label: "Meu caderno", icon: NotebookTabs },
  { href: "/atividade", label: "Minha atividade", icon: History },
  { href: "/glossario", label: "Glossário", icon: BookType },
];
const account: Item[] = [
  { href: "/perfil", label: "Meu perfil", icon: CircleUserRound },
  { href: "/seguranca", label: "Conta e segurança", icon: ShieldCheck },
  { href: "/assinatura", label: "Assinatura", icon: CreditCard },
  { href: "/ajuda", label: "Ajuda", icon: HelpCircle },
];

export function StudentNavigation({
  pathname,
  workoutHref,
  isAdmin,
  navRef,
  onNavigate,
  onScroll,
}: {
  pathname: string;
  workoutHref: string;
  isAdmin: boolean;
  navRef: RefObject<HTMLElement | null>;
  onNavigate: () => void;
  onScroll: (element: HTMLElement) => void;
}) {
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const tools = [
    { href: workoutHref, label: "Treino do dia", icon: BookOpen },
    ...advanced,
  ];
  const accountItems = [
    ...account,
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];
  const links = (items: Item[]) =>
    items.map(({ href, label, icon: Icon }) => (
      <Link
        key={href}
        href={href}
        className={isActive(href) ? "active" : ""}
        aria-current={isActive(href) ? "page" : undefined}
        onClick={onNavigate}
      >
        <Icon aria-hidden="true" />
        {label}
      </Link>
    ));
  return (
    <nav
      ref={navRef}
      className={`sidebar-nav ${styles.navigation}`}
      aria-label="Área do aluno"
      onScroll={(event) => onScroll(event.currentTarget)}
    >
      <div
        role="group"
        aria-label="Navegação principal"
        className={styles.primary}
      >
        {links(primary)}
      </div>
      <details
        key={`tools:${pathname}`}
        open={
          tools.some((item) => isActive(item.href)) ||
          pathname.startsWith("/treino/")
        }
        className={styles.group}
      >
        <summary>
          Explorar <ChevronRight aria-hidden="true" />
        </summary>
        <div role="group" aria-label="Recursos adicionais">
          {links(tools)}
        </div>
      </details>
      <details
        key={`account:${pathname}`}
        open={accountItems.some((item) => isActive(item.href))}
        className={styles.group}
      >
        <summary>
          Conta <ChevronRight aria-hidden="true" />
        </summary>
        <div role="group" aria-label="Conta e configurações">
          {links(accountItems)}
        </div>
      </details>
    </nav>
  );
}
