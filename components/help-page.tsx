"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Search,
  TerminalSquare,
} from "lucide-react";
import { PageIntro } from "@/components/ui";

const articles = [
  {
    category: "Começando",
    title: "Como funciona meu primeiro treino?",
    text: "Leia o conceito curto, pratique no editor, execute, envie e use pistas progressivas quando precisar.",
  },
  {
    category: "Editor e terminal",
    title: "Por que meu código não executa?",
    text: "Confira a mensagem do terminal. Loops infinitos são interrompidos e saídas excessivas são limitadas para proteger o ambiente.",
  },
  {
    category: "Tutor IA",
    title: "O Tutor está indisponível. Posso continuar?",
    text: "Sim. Editor, executor, testes e erros técnicos continuam funcionando mesmo sem o Tutor externo.",
  },
  {
    category: "XP e níveis",
    title: "Por que não recebi XP?",
    text: "Repetições da mesma origem não geram XP novamente. O extrato informa qual evento concedeu cada recompensa.",
  },
  {
    category: "Linguagens",
    title: "O que significa linguagem bloqueada?",
    text: "No plano gratuito, nível e domínio liberam linguagens. O Premium libera o catálogo, mas a execução externa ainda depende do serviço seguro correspondente.",
  },
  {
    category: "Revisões",
    title: "Como funciona a revisão?",
    text: "O intervalo aumenta quando você demonstra domínio e diminui quando o conceito precisa de reforço.",
  },
  {
    category: "Conta",
    title: "Como protejo minha conta?",
    text: "Em Conta e segurança você altera senha, revisa dispositivos, encerra outras sessões, exporta dados e solicita exclusão.",
  },
  {
    category: "Pagamentos",
    title: "Uma falha de pagamento apaga meu progresso?",
    text: "Não. O status da assinatura pode mudar, mas tentativas, projetos, anotações e progresso permanecem associados à conta.",
  },
];

export function HelpPage() {
  const [query, setQuery] = useState("");
  const [openArticle, setOpenArticle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("technical");
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return term
      ? articles.filter((article) =>
          `${article.category} ${article.title} ${article.text}`
            .toLocaleLowerCase("pt-BR")
            .includes(term),
        )
      : articles;
  }, [query]);

  const submitReport = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/support/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-logiclab-request": "same-origin",
      },
      body: JSON.stringify({
        category,
        summary,
        page: window.location.href,
      }),
    });
    const payload = (await response.json()) as { id?: string; error?: string };
    if (!response.ok)
      return setError(payload.error ?? "Falha ao enviar report.");
    setTicket(payload.id ?? "");
    setSummary("");
  };

  return (
    <div className="standard-page help-page">
      <PageIntro
        eyebrow="CENTRAL DE AJUDA"
        title="Como podemos ajudar?"
        text="Busque uma resposta ou envie um problema técnico sem compartilhar código ou dados pessoais desnecessários."
      />
      <label className="help-search">
        <Search />
        <input
          aria-label="Buscar na central de ajuda"
          placeholder="Busque por editor, XP, conta, pagamento..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="help-layout">
        <section className="help-articles">
          {filtered.map((article) => (
            <article className="panel-card" key={article.title}>
              <button
                type="button"
                aria-expanded={openArticle === article.title}
                onClick={() =>
                  setOpenArticle((current) =>
                    current === article.title ? "" : article.title,
                  )
                }
              >
                <span>
                  <small>{article.category}</small>
                  <b>{article.title}</b>
                </span>
                <ChevronDown />
              </button>
              {openArticle === article.title && <p>{article.text}</p>}
            </article>
          ))}
          {!filtered.length && (
            <div className="panel-card help-empty">
              <CircleHelp /> Nenhum artigo encontrado. Envie sua dúvida abaixo.
            </div>
          )}
        </section>
        <aside className="help-categories panel-card">
          <h2>Assuntos</h2>
          <span>
            <BookOpen /> Começando e aprendizagem
          </span>
          <span>
            <TerminalSquare /> Editor e problemas técnicos
          </span>
          <span>
            <CreditCard /> Conta e pagamentos
          </span>
        </aside>
      </div>
      <form className="support-report panel-card" onSubmit={submitReport}>
        <header>
          <Bug />
          <div>
            <h2>Reportar problema técnico</h2>
            <p>
              Página, navegador, horário e versão são anexados. Não envie sua
              senha, tokens ou código pessoal.
            </p>
          </div>
        </header>
        <label>
          <span>Tipo</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="technical">Problema técnico</option>
            <option value="account">Conta</option>
            <option value="billing">Pagamento</option>
            <option value="content">Conteúdo confuso</option>
          </select>
        </label>
        <label>
          <span>O que aconteceu?</span>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </label>
        <button className="button button-primary">Enviar report</button>
        {ticket && (
          <div className="inline-success" role="status">
            <CheckCircle2 /> Ticket {ticket} aberto. Status: Aberto.
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}
      </form>
    </div>
  );
}
