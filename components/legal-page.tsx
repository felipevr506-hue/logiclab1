import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";

export function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const privacy = kind === "privacy";
  return (
    <main className="legal-page">
      <header>
        <Brand />
        <Link href="/">
          <ArrowLeft /> Voltar ao início
        </Link>
      </header>
      <article>
        <span>LOGICLAB · TRANSPARÊNCIA E CONTROLE</span>
        <h1>{privacy ? "Política de privacidade" : "Termos de uso"}</h1>
        <p className="legal-updated">
          Última atualização: 21 de agosto de 2026
        </p>
        {privacy ? (
          <>
            <h2>Quais dados tratamos</h2>
            <p>
              O funcionamento pode exigir nome, e-mail, credencial derivada,
              sessões, preferências, progresso, tentativas, rascunhos, projetos,
              anotações, feedback e registros técnicos mínimos. Senhas nunca são
              armazenadas em texto puro e dados completos de cartão não
              pertencem ao LogicLab.
            </p>
            <h2>Por que usamos esses dados</h2>
            <p>
              Usamos os dados para autenticar a conta, preservar o trabalho,
              corrigir exercícios, personalizar revisões, operar assinatura,
              prevenir abuso, prestar suporte e melhorar estabilidade e
              conteúdo. Não coletamos localização exata nem data de nascimento
              completa sem necessidade definida.
            </p>
            <h2>Tutor, executor e pagamentos</h2>
            <p>
              O Tutor pode receber o enunciado, código relacionado ao exercício,
              testes e histórico pedagógico necessário. Métricas de uso evitam
              guardar conteúdo além do necessário. O executor aplica limites de
              código, entrada, saída e duração. O provedor de pagamento processa
              os dados financeiros sob sua própria política; o LogicLab recebe
              apenas identificadores, valores e status necessários.
            </p>
            <h2>Armazenamento, cookies e segurança</h2>
            <p>
              A versão local usa armazenamento do navegador e arquivos do
              servidor desta instalação. Contas reais usam cookie de sessão
              HttpOnly. Em produção, transferência deve ocorrer por HTTPS e os
              prazos de retenção precisam seguir a finalidade, obrigações legais
              e política documentada de backup.
            </p>
            <h2>Seus direitos e escolhas</h2>
            <p>
              Em Conta e segurança é possível exportar dados, encerrar outros
              dispositivos, corrigir informações e solicitar exclusão. Alguns
              registros podem precisar de retenção quando houver obrigação legal
              ou prevenção legítima de fraude. Solicitações também podem ser
              enviadas ao contato abaixo.
            </p>
            <h2>Revisão antes do lançamento</h2>
            <p>
              Este texto descreve a arquitetura atual, mas não substitui análise
              jurídica. Antes da operação comercial, deve ser revisado com os
              provedores, bases legais, retenções e responsável pelo tratamento
              efetivamente adotados.
            </p>
          </>
        ) : (
          <>
            <h2>Conta e uso permitido</h2>
            <p>
              O LogicLab é uma plataforma de prática de programação. Você deve
              proteger sua credencial e não usar Tutor, executor, suporte ou
              APIs para abuso, automação maliciosa, violação de terceiros ou
              tentativa de contornar limites técnicos e de plano.
            </p>
            <h2>Conteúdo e progresso</h2>
            <p>
              O produto busca preservar tentativas, rascunhos e versões,
              inclusive durante falhas de conexão. A instalação local não
              substitui uma infraestrutura de produção com banco, backups
              testados e conta autenticada. Conteúdo educacional não equivale a
              certificado oficial.
            </p>
            <h2>Planos, cobrança e cancelamento</h2>
            <p>
              Preço, recursos e periodicidade devem ser mostrados antes do
              checkout. O acesso Premium depende da confirmação recebida por
              webhook, não apenas do retorno do checkout. Cancelar renovação não
              remove acesso já pago antes do fim do período aplicável. Falha,
              cancelamento ou reembolso não apagam o progresso do aluno.
            </p>
            <h2>Disponibilidade e suporte</h2>
            <p>
              Serviços externos podem ficar temporariamente indisponíveis. A
              plataforma informa o estado e procura manter leitura, edição e
              progresso quando Tutor ou executor estiverem pausados. Problemas
              podem ser enviados pela Central de ajuda com um identificador de
              ticket.
            </p>
            <h2>Revisão jurídica</h2>
            <p>
              Condições comerciais finais, foro, responsabilidade, regras de
              reembolso e atendimento devem ser revisados por assessoria
              jurídica antes do lançamento ao público.
            </p>
          </>
        )}
        <p className="legal-contact">
          Dúvidas:{" "}
          <a href="mailto:contato@logiclab.dev">contato@logiclab.dev</a>
        </p>
      </article>
    </main>
  );
}
