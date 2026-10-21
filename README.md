# LogicLab

> **HomologaÃ§Ã£o necessÃ¡ria antes de produÃ§Ã£o.** AutenticaÃ§Ã£o PostgreSQL,
> e-mail Resend e billing Hotmart estÃ£o implementados, mas dependem de
> infraestrutura/credenciais reais. Executor confiÃ¡vel, conteÃºdo privado e XP
> autoritativo continuam entre os bloqueios descritos em `SECURITY.md`.

Plataforma de treino diário de lógica de programação. Este repositório contém um MVP navegável com editor JavaScript, execução local para desenvolvimento, sincronização versionada, Playground, progressão demonstrativa, tutoria progressiva, revisão, biblioteca e painel administrativo.

## Executar localmente

Requisitos: Node.js 22 LTS ou superior e npm.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Para validar uma versão de produção:

```bash
npm run typecheck
npm run build
npm start
```

O app inicia em **modo local/MVP**, sem exigir serviço externo. Em produção,
contas, sessões, tokens, perfis, assinaturas e progresso usam
Prisma/PostgreSQL; sem `DATABASE_URL`, a autenticação falha fechada. O
navegador mantém apenas um espelho em `localStorage`/IndexedDB para autosave e
offline. O fallback em arquivo existe somente em desenvolvimento/testes, e o
rate limit ainda precisa de Redis em implantações com múltiplas instâncias.

> Se a instalação falhar com `ENOSPC`, libere espaço no volume do projeto antes de tentar novamente. O conjunto do Next.js, Monaco e compilador nativo não cabe em um volume sem espaço livre.

## O que já funciona

- landing page completa com identidade hacker premium, chuva de código verde leve, redução de movimento, responsividade, acessibilidade e metadados SEO;
- tema escuro/claro persistente;
- cadastro/login reais no servidor local, senha derivada com scrypt, sessão HttpOnly, recuperação de uso único, lista de dispositivos, troca de senha/e-mail, exportação e exclusão de conta;
- dashboard com próximo treino, XP, nível, sequência, metas, calendário, recomendação adaptativa, revisão e plano semanal baseado em tempo, dias e foco escolhidos;
- programação rotativa dos Treinos 01 a 14, com troca automática a cada dia no horário de Brasília;
- somente o treino diário liberado para o aluno; demais dias exibidos como bloqueados;
- seletor administrativo para pré-visualizar qualquer treino sem publicá-lo para o aluno;
- trilha com cinco níveis e indicação de bloqueio/domínio;
- treino com etapa de conceito, exercícios graduais e desafio;
- Monaco Editor auto-hospedado, com destaque de sintaxe, linhas, tela ampliada, limpar e autosave;
- indicador honesto “Salvando/Salvo/Offline/Falha”, fila de gravação e tentativa posterior;
- histórico de versões em execução, envio, conclusão, importação e salvamento manual, com comparação por linha e restauração sem perder a versão atual;
- importação validada por extensão/tamanho, download com extensão correta, cópia e salvamento de trechos no caderno;
- atalhos de teclado para executar, enviar, abrir Tutor e modo foco, com modal de consulta;
- execução JavaScript local em Web Worker para desenvolvimento/testes, sem autoridade de correção e sem equivaler a um sandbox de segurança; o runner fica desativado no ambiente estrito;
- Playground livre com linguagens desbloqueadas, stdin, terminal, limpar/resetar, Tutor local, versões e nenhuma concessão de XP;
- Laboratório com experimentos editáveis, Monaco, autosave, versões, execução JavaScript real e terminal, sem concessão de XP;
- entrada de teste tipada para exercícios que recebem número, texto ou JSON, disponível no código como `input`/`prompt()`;
- console, testes automáticos e feedback separado para sintaxe, runtime e lógica;
- tutor contextual funcional com conversa, quatro ações rápidas, pergunta livre, cinco níveis de ajuda, prompt versionado, uso agregado e feedback útil/não útil;
- tutor recebe enunciado, código atual, resultado dos testes, erro, tentativa e dicas sem exigir copiar/colar;
- solução completa bloqueada até pedido explícito depois de três tentativas e das pistas progressivas;
- histórico detalhado com código, data, testes aprovados/reprovados, erro, dicas, mensagens e número da tentativa;
- XP demonstrativo centralizado em transações locais por conclusão, treino, desafio, projeto ou missão; o servidor não aceita XP forjado pelo navegador e a concessão confiável aguarda o executor externo;
- curva não linear de níveis, salto de vários níveis e concessão única de todas as recompensas intermediárias;
- 11 habilidades com domínio baseado em dificuldade, acertos, tentativas, dicas e evidências recentes;
- catálogo de JavaScript, Python, Java, C e C++, com requisitos separados de plano, nível e domínio, além da seleção da linguagem principal;
- telas de habilidades, linguagens e recompensas alimentadas pelo estado persistido real;
- prática livre por assunto e dificuldade, separada da trilha e com XP semanal antifarm;
- missão semanal baseada nas transações da semana de Brasília, com resgate único;
- projetos Calculadora e Sistema de notas em etapas verificadas pelos testes reais;
- portfólio gerado somente a partir de projetos realmente concluídos, com código final, cópia e download;
- página de evolução com erros frequentes, comparação de código e replay de cada tentativa real;
- relatório semanal calculado por tentativas, XP, acerto, dicas, tempo, habilidades, linguagem e sequência;
- conquistas concedidas por evidências de solução, domínio, debugging, linguagem e projeto;
- modo prova sem dicas ou tutor durante a resolução, resultado persistente e refação sem perda de XP;
- exercício “Corrija o código” para loops e aviso opcional do tutor após 1,3 s sem digitação;
- caderno com busca, favoritos, anotações, explicações do Tutor e códigos salvos;
- glossário pesquisável, exemplos por conceito e explicação contextual no treino;
- busca global por exercícios, projetos, conceitos, notas, explicações e códigos, preservando bloqueios;
- histórico “Minha atividade” derivado de tentativas, XP, versões e materiais realmente salvos;
- feedback opcional e reports por exercício, com fila e status no Admin;
- página de perfil, avatar, preferências de notificação e redução de movimento;
- tipografia responsiva sem `zoom` global, com modos Compacto, Padrão e Grande persistentes;
- fonte do editor ajustável entre 15px e 20px pelos controles A−/A+, também persistente;
- viewport acessível com zoom manual permitido até 5×;
- checkout Hotmart server-side com vínculo opaco à conta, webhook autenticado/idempotente, estados de assinatura, cancelamento e página “Meu plano”; nenhum retorno visual libera Premium;
- painel admin protegido server-side no modo obrigatório, com visualização segura de assinaturas, CRUD editorial demonstrativo, analytics reais, custos do Tutor, auditoria de flags, feedback, feature flags persistidas e saúde dos serviços;
- gate de Playground validado também no servidor; flags locais preparadas para os demais recursos;
- estados globais de carregamento, erro, vazio e sucesso;
- central de ajuda pesquisável, report técnico persistido, 404/500 seguros e modo de manutenção global;
- endpoint de saúde sem cache em `/api/status`, sitemap, robots e cabeçalhos de segurança.

## Testes de ponta a ponta

A auditoria automatizada usa Chromium em desktop e um Pixel 7 emulado. Na primeira execução, instale o navegador do Playwright e depois rode a suíte:

```bash
npx playwright install chromium
npm run test:e2e
```

O comando inicia um servidor temporário isolado na porta 3199 e encerra o
processo ao final. A suíte cobre 220 casos em desktop/mobile, incluindo
autenticação, isolamento, billing antifraude e viewports de 360, 390 e 430 px.
Ela usa um worker por padrão porque exercita estado server-side e feature
flags. Para abrir o relatório HTML:

```bash
npm run test:e2e:report
```

O inventário funcional está em `RELATORIO_TESTES.md`; o parecer de segurança vigente está em `docs/SECURITY_AUDIT_2026-08-21.md` e `SECURITY.md`.

## Arquitetura

```text
app/                    rotas, layouts e tokens responsivos de legibilidade
components/             UI e experiências de produto
lib/config.ts           preço, XP e limites centralizados
lib/gamification-config.ts curva de níveis, recompensas, idiomas e habilidades
lib/content.ts          conteúdo independente do executor/idioma
lib/daily-workouts.ts   rotação diária e catálogo dos Treinos 01–14
lib/app-state.tsx       estado central, autosave, merge e sincronização
services/code-runner/   contrato e executor JavaScript
services/persistence/   banco IndexedDB do modo local
services/sync/          backup versionado e resolução de conflitos
services/admin/         persistência server-side de feature flags
services/auth/          contas locais, sessões, senha e recuperação
services/security/      origem confiável, rate limits e metadados seguros
services/entitlements/  permissões centralizadas por plano
services/payments/      contrato agnóstico de gateway
services/ai/            contrato, prompt e tutor socrático local
services/support/       tickets técnicos sem conteúdo sensível
services/gamification/  XP transacional, domínio e recomendação adaptativa
services/learning/      missões, projetos, relatório e conquistas
prisma/                 schema PostgreSQL e seed de desenvolvimento
```

O conteúdo referencia `language: javascript` no banco e o executor implementa uma interface própria. Novas linguagens entram como outro adaptador, sem alterar os componentes de treino. O mesmo vale para pagamentos: Stripe ou Mercado Pago devem implementar `PaymentGateway`.

## Banco de dados

O schema em `prisma/schema.prisma` modela usuários, perfis, assinaturas, trilhas, níveis, recompensas, idiomas, habilidades, tentativas, mensagens, sequência, missões, projetos, relatórios, avaliações, conquistas, revisões, favoritos, notas, versões de código, Playground, explicações, feedback, preferências, feature flags, backups e conflitos. `XPTransaction` possui unicidade por usuário/origem para impedir farm no banco.

1. Copie `.env.example` para `.env`.
2. Configure `DATABASE_URL` para PostgreSQL.
3. Rode as ferramentas já instaladas no projeto:

```bash
npm run db:format
npm run db:validate
npm run db:generate
npm run db:push
npm run db:seed
```

O seed é idempotente e cria conteúdo didático, 20 níveis de XP, recompensas, 5 linguagens, requisitos, 11 habilidades, missão, projetos, conquistas, desafio e avaliação. Ele não inventa usuários, depoimentos ou métricas.

## Integrações de produção

O modo local foi deliberadamente separado das integrações que dependem de infraestrutura:

- **autenticação:** Prisma/PostgreSQL e entrega Resend estão implementados; falta provisionar banco/domínio/credenciais e migrar o rate limit para Redis;
- **pagamentos:** o adapter e webhook Hotmart estão implementados; falta configurar produto/oferta/checkout/OAuth, cadastrar URLs e homologar eventos reais no sandbox;
- **execução de código:** o Web Worker executa JavaScript no navegador, sem acesso à rede e com timeout. Python, Java, C e C++ permanecem explicitamente bloqueados para execução até a integração com runners efêmeros por contêiner, com CPU, memória, tempo e rede limitados; nenhum resultado dessas linguagens é simulado;
- **IA:** o `SocraticFallbackTutor` é funcional e determinístico quando não há chave. Para IA generativa, implemente `TutorService` em uma rota server-side, use `OPENAI_API_KEY` (nunca `NEXT_PUBLIC_`) e preserve o prompt/contrato estruturado de `services/ai/tutor.ts`;
- **sincronização:** produção persiste o backup versionado em PostgreSQL; o fallback `.data/progress` permanece somente no modo local;
- **admin:** rotas, flags, custos e auditoria estão protegidos; o CRUD editorial ainda é de sessão e precisa usar as versões/publicações modeladas no PostgreSQL;
- **infraestrutura:** usar Redis para rate limit distribuído, monitoramento externo, alertas, backups restaurados em teste e runners isolados para linguagens externas.

Nenhuma chave deve usar prefixo `NEXT_PUBLIC_`, exceto valores realmente públicos. `.env` está ignorado pelo Git.

## Conteúdo de demonstração

Há exercícios funcionais de variáveis, condições, loops, listas e uma calculadora. Hoje, testes e soluções ainda chegam ao bundle por `lib/content.ts`; esse é um bloqueador crítico de produção e o conteúdo privado deve ser movido para o servidor antes do lançamento.
