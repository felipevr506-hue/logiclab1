import Link from "next/link";
import { ArrowRight, Bot, Braces, Code2, Route, Terminal } from "lucide-react";
import { Brand } from "@/components/brand";
import styles from "./landing-page.module.css";

const benefits = [
  {
    icon: Code2,
    title: "Aprenda praticando",
    text: "Escreva código desde o começo, um conceito por vez.",
  },
  {
    icon: Bot,
    title: "Receba orientação quando errar",
    text: "Entenda seus erros com dicas do Tutor e tente de novo.",
  },
  {
    icon: Route,
    title: "Evolua com exercícios e projetos",
    text: "Dê o próximo passo com desafios que acompanham sua evolução.",
  },
];
const steps = [
  { title: "Crie sua conta", text: "Cadastre-se e confirme seu e-mail." },
  {
    title: "Aprenda e pratique",
    text: "Entenda o conceito e teste suas ideias com código.",
  },
  {
    title: "Evolua no seu ritmo",
    text: "Continue de onde parou, um desafio por vez.",
  },
];
const faqs = [
  {
    question: "Preciso saber programar?",
    answer:
      "Não. Você pode começar do zero, com conceitos e exercícios de JavaScript.",
  },
  {
    question: "Posso começar gratuitamente?",
    answer: "Sim. Crie sua conta gratuita para começar a aprender e praticar.",
  },
  {
    question: "Como o Tutor me ajuda?",
    answer:
      "O Tutor oferece explicações e dicas durante a prática para ajudar você a entender o erro e tentar novamente.",
  },
];

function StartLink({ continueHref }: { continueHref: string | null }) {
  return (
    <Link className={styles.primary} href={continueHref ?? "/entrar"}>
      {continueHref ? "Continuar aprendendo" : "Começar grátis"}
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

function ProductPreview() {
  return (
    <section
      className={styles.previewSection}
      aria-labelledby="preview-title"
      id="pratica"
    >
      <div className={styles.sectionHeading}>
        <span className={styles.eyebrow}>DO CONCEITO AO CÓDIGO</span>
        <h2 id="preview-title">Um espaço para tentar e entender.</h2>
        <p>Exercício, código e orientação, juntos na sua prática.</p>
      </div>
      <figure className={styles.preview}>
        <figcaption className={styles.previewBar}>
          <span>
            <Braces size={17} aria-hidden="true" /> Sua primeira mensagem
          </span>
          <span>Prévia ilustrativa · JavaScript</span>
        </figcaption>
        <div className={styles.previewGrid}>
          <div className={styles.editor}>
            <div className={styles.fileName}>
              <Code2 size={15} aria-hidden="true" /> mensagem.js
            </div>
            <pre aria-label="Exemplo de código">
              <code>
                <span className={styles.keyword}>const</span>
                {" nome = "}
                <span className={styles.string}>{'"Ana"'}</span>
                {";\n\nconsole.log("}
                <span className={styles.string}>{'"Olá, "'}</span>
                {" + nome);"}
              </code>
            </pre>
            <div className={styles.output}>
              <span>
                <Terminal size={15} aria-hidden="true" /> Saída do exemplo
              </span>
              <code>Olá, Ana</code>
            </div>
          </div>
          <aside
            className={styles.tutor}
            aria-label="Exemplo de orientação do Tutor"
          >
            <span className={styles.tutorLabel}>
              <Bot size={18} aria-hidden="true" /> Tutor de Lógica
            </span>
            <h3>O que muda se você trocar o nome?</h3>
            <p>
              Observe como a variável compõe a mensagem. Experimente outro valor
              e compare o resultado.
            </p>
            <span className={styles.previewNote}>
              Dicas para pensar no próximo passo.
            </span>
          </aside>
        </div>
      </figure>
    </section>
  );
}

export function LandingPage({ continueHref }: { continueHref: string | null }) {
  return (
    <main className={styles.page}>
      <a href="#conteudo" className={styles.skipLink}>
        Pular para o conteúdo
      </a>
      <div className={styles.container}>
        <header className={styles.header}>
          <Brand />
          <nav className={styles.nav} aria-label="Navegação principal">
            <a href="#como-funciona" className={styles.howLink}>
              Como funciona
            </a>
            <Link href={continueHref ?? "/entrar"}>
              {continueHref ? "Minha conta" : "Já tenho uma conta"}
            </Link>
          </nav>
        </header>
        <section
          className={styles.hero}
          aria-labelledby="hero-title"
          id="conteudo"
        >
          <span className={styles.eyebrow}>
            <span className={styles.dot} /> SUA LÓGICA, NA PRÁTICA
          </span>
          <h1 id="hero-title">
            Aprenda programação.
            <br />
            <span>Coloque suas ideias em código.</span>
          </h1>
          <p>
            Pratique com exercícios e projetos, entenda seus erros com o Tutor e
            avance no seu ritmo.
          </p>
          <div className={styles.actions}>
            <StartLink continueHref={continueHref} />
            {!continueHref && (
              <Link href="/entrar" className={styles.secondary}>
                Já tenho uma conta
              </Link>
            )}
          </div>
          <p className={styles.heroNote}>
            {continueHref
              ? "Seu próximo passo está esperando por você."
              : "Comece do zero. Uma conta, seu próprio caminho."}
          </p>
        </section>
        <section
          className={styles.benefits}
          aria-label="Três motivos para praticar com o LogicLab"
        >
          {benefits.map(({ icon: Icon, title, text }) => (
            <article className={styles.benefit} key={title}>
              <Icon size={23} aria-hidden="true" />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>
        <ProductPreview />
        <section
          className={styles.stepsSection}
          id="como-funciona"
          aria-labelledby="steps-title"
        >
          <div className={styles.sectionHeading}>
            <span className={styles.eyebrow}>SIMPLES PARA COMEÇAR</span>
            <h2 id="steps-title">Três passos. Muitas descobertas.</h2>
          </div>
          <ol className={styles.steps}>
            {steps.map(({ title, text }, index) => (
              <li key={title}>
                <span className={styles.stepNumber}>0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className={styles.finalCta} aria-labelledby="cta-title">
          <div>
            <h2 id="cta-title">Seu próximo passo começa com uma tentativa.</h2>
            <p>Abra espaço para aprender fazendo.</p>
          </div>
          <StartLink continueHref={continueHref} />
        </section>
        <section className={styles.faq} aria-labelledby="faq-title">
          <h2 id="faq-title">Antes de começar</h2>
          <div>
            {faqs.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} LogicLab</span>
          <nav aria-label="Informações legais">
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade">Privacidade</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
