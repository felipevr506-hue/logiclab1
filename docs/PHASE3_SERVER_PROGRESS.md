# Fase 3 — progresso oficial no servidor

Escopo: tentativas, conclusão, XP, nível, sequência e domínio. Nenhuma mudança de layout em landing, dashboard, navegação ou Tutor IA. As Fases 1 e 2 continuam sendo pré-requisitos de identidade, isolamento e e-mail confirmado.

## Auditoria e ponto da retomada

Antes, `training-workspace` executava os testes no Web Worker do navegador e enviava o resultado ao `recordAttempt` local. O `app-state` calculava conclusão, XP, domínio e recompensas; `synchronizeProgressState` podia fabricar lançamentos a partir de conclusões antigas. O `/api/progress` neutralizava esses campos no backup, mas a mesclagem voltava a unir valores locais. Portanto o backup não concedia privilégios no banco, mas o navegador continuava sendo a origem do progresso exibido.

Antes da implementação, foi criado `.tmp/phase3-before`, incluindo código e `loglab-before.dump`. Git não estava disponível/configurado. O backup PostgreSQL foi validado com `pg_restore --list`. A contagem inicial era de dois usuários e zero tentativas, lançamentos de XP e registros de UserProgress.

Na retomada, seis testes novos de integração e 26 testes unitários/segurança já haviam passado. As últimas validações de prova/trilha e o cenário de nível/recompensas ainda precisavam da rodada completa. A implementação não foi refeita. A revisão restringiu a análise de constantes: declarações `using`, tipos, afirmações de inicialização de TypeScript, bindings fora da referência e `typeof` de nomes desconhecidos não são aceitos como prova segura. Esses casos ganharam testes de regressão. Também foi corrigida a remoção da chave pendente após recibo confirmado, permitindo uma nova intenção de prática sem reutilizar indefinidamente o recibo anterior; o oitavo teste cobre duas submissões reais pelo editor e recarregamento.

## Arquitetura nova

`POST /api/attempts` autentica a sessão e exige e-mail confirmado. Recebe apenas exercício, código, chave de idempotência e contexto de atividade. Campos como userId, ownerId, passed, testes, XP, domínio e datas são rejeitados. O proprietário vem exclusivamente da sessão. O servidor também valida liberação da trilha pelo calendário de Brasília, projeto/etapa e os exercícios da prova. Prévia administrativa depende do papel persistido no servidor.

A avaliação estática ocorre sem executar o código enviado. A gravação usa uma transação PostgreSQL com bloqueio da linha do usuário e da sessão, seguida de nova conferência de validade da sessão. Ela grava, como unidade:

- Attempt e seu resultado oficial/versionamento;
- ExerciseProgress e LessonProgress;
- XPTransaction e UserProgress, incluindo snapshot oficial e revisão;
- Streak, UserSkill e recompensas UserReward/HelpTokenTransaction quando aplicáveis.

O catálogo confiável vem do conteúdo versionado do projeto. As referências relacionais publicadas são criadas sob demanda, dentro da transação; não são substituídas quando já existem. Divergência com a solução/versão publicada resulta em conflito, exigindo reconciliação explícita do conteúdo. Não há execução de código para preencher essas tabelas.

`GET /api/attempts` devolve o progresso oficial da conta atual. O cliente só aplica respostas do mesmo proprietário e não aceita revisão inferior à já carregada. Trocas de conta continuam desmontando o estado da conta anterior. Foco, reconexão e notificações entre abas atualizam a leitura oficial.

Rascunhos, notas, histórico de versões de código, favoritos e preferências continuam locais/sincronizáveis e separados por conta. Tentativas e recompensas em localStorage/IndexedDB são apenas cópias de apresentação: não são restauradas como autoridade. Falha na leitura oficial não promove dados locais a progresso confiável. Nesse caso o progresso confiável começa neutro, preservando os rascunhos.

O `/api/progress` armazena apenas backup sanitizado, com recompensas neutralizadas. As respostas podem sobrepor o snapshot oficial de leitura, mas PUT nunca escreve em Attempt, XPTransaction ou UserProgress. A mesclagem genérica une apenas material do usuário e mantém o progresso oficial já verificado; não faz união de conclusões, XP ou domínio. A rotina de migração que transformava conclusões do navegador em XP foi removida.

## Migration

`prisma/migrations/20261017210000_authoritative_attempts/migration.sql`, aplicada ao `loglab`:

- Attempt: idempotencyKey e requestHash opcionais, evaluationStatus com default `legacy` e officialResult opcional.
- Índice único composto `(userId, idempotencyKey)`; registros anteriores com chave nula continuam válidos.
- UserProgress: authoritativeState opcional e revision com default zero.

Nenhuma tabela nova foi criada e nenhuma tabela, migration, usuário ou dado anterior foi apagado. As tabelas de tentativas/progresso/ledger já existentes foram reutilizadas. Dados legados de demonstração do navegador não são convertidos em recompensas oficiais.

## APIs

| Rota                       | Função                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| GET `/api/attempts`        | Snapshot oficial exclusivamente da sessão atual                              |
| POST `/api/attempts`       | Validação e registro transacional/idempotente da tentativa                   |
| POST `/api/attempts/hint`  | Registra dicas oficiais por conta/exercício e devolve a contagem do servidor |
| POST `/api/attempts/claim` | Confere elegibilidade real de missão/projeto e concede uma única vez         |
| GET/PUT `/api/progress`    | Backup de material/preferências, sem autoridade para conceder recompensas    |

As mutações exigem a proteção existente de origem e possuem limites por conta/IP conforme a operação. Tentativas limitam código a 20 mil caracteres e JSON a 90 mil caracteres, com conferência do Content-Length declarado. A avaliação também limita nós/profundidade e o trabalho de análise.

## Idempotência e concorrência

O cliente guarda uma chave por conta/exercício/conteúdo enquanto o resultado não foi confirmado e a reutiliza em reenvio/recarregamento. Após confirmação, remove somente essa chave, permitindo uma nova intenção de prática com chave nova. O banco impõe unicidade por usuário/chave. O requestHash SHA-256 inclui exercício, código e contexto normalizado; reutilizar a chave com outro conteúdo resulta em HTTP 409. Uma repetição válida devolve o recibo original com `replayed: true` e o snapshot oficial atual, sem nova tentativa nem concessão.

Chaves novas não permitem multiplicar recompensas de primeira conclusão: o ledger mantém sua unicidade anterior `(userId, uniqueKey)`, usando chaves como `exercise:<id>:completion`. Bloquear o usuário durante a transação serializa duas abas e outras concessões da mesma conta. Sem transação confirmada, nenhum recibo de sucesso é retornado. Falha resulta em HTTP 503 e permite reenviar a mesma chave.

## Regras de progresso

- Primeira conclusão na trilha: 10 XP fácil, 25 médio ou 50 desafio, conforme configuração existente.
- Bônus sem dica oficial: 10 XP, com base no histórico de dicas registrado pelo servidor; o cliente não envia sua contagem. Isso não é prova de ausência de ajuda externa ou de consulta ao bundle.
- Exercício correspondente ao treino diário oficial: bônus de desafio 30 XP e treino 40 XP, apenas na primeira conclusão, com chaves únicas e data do servidor em Brasília.
- Exemplo testado: primeiro exercício, sem dica, no dia de cadastro = 10 + 10 + 30 + 40 = **90 XP**.
- Prática: 15 XP por exercício/semana de Brasília, uma vez. Repetir a trilha não paga novamente a primeira conclusão.
- Missões e projetos usam os critérios existentes, calculados sobre tentativas/lançamentos oficiais. O cliente só solicita a conferência.
- Nível é derivado dos thresholds existentes e do ledger confiável. Recompensas de nível e conquistas são únicas por conta.
- Domínio reutiliza a fórmula de pesos por dificuldade, qualidade, número de tentativas e dicas oficiais. Reenviar uma resposta correta com chave nova não acrescenta evidências positivas repetidas do mesmo exercício.
- Atividade e sequência vêm de avaliações reconhecidas e do calendário do servidor. Uma avaliação pendente não concede atividade, domínio, XP ou conclusão.

## Avaliação segura sem executor isolado

Não há eval, Function, vm, subprocesso nem execução de JavaScript enviado ao servidor. O TypeScript é usado como **parser**, agora dependência de produção. A aplicação analisa a árvore sintática, não executa nem transpila o programa para rodá-lo.

Existem dois caminhos limitados:

1. **Resposta homologada:** compara a estrutura da árvore sintática com a solução confiável do catálogo. Comentários e formatação não importam; valores de literais, nomes, operadores, tipo de declaração e estrutura importam. Não é uma prova de equivalência semântica geral. A aprovação reconhece uma resposta previamente homologada; não afirma ter executado os testes dinamicamente. Os testes unitários executam somente as soluções fixas do próprio repositório para conferir sua compatibilidade com os testes do catálogo — nunca submissões de usuários.
2. **Análise de constantes:** reconhece um subconjunto pequeno de declarações com valores primitivos e `console.log`. As variáveis precisam constar nas declarações de topo da referência homologada; variáveis auxiliares desconhecidas ficam pendentes. Calcula literais, concatenação, templates, typeof, negação e parênteses somente sobre valores locais já conhecidos, comparando-os com as expectativas do exercício. Não presume que um nome desconhecido é undefined: ele poderia ser global ou estar na temporal dead zone. Não chama funções do programa, métodos arbitrários, rede, filesystem, imports, getters ou construtores. Declarações com recursos/TypeScript são excluídas.

Uma resposta pode estar correta e ainda ficar **pending**. Exemplos: `return n + n` em vez de `return numero * 2`, renomear parâmetros de uma função, usar operador ternário, outra estrutura de loop, métodos alternativos de arrays ou funções auxiliares. Mesmo aspas em estruturas de template e outras representações sintáticas equivalentes podem não ser reconhecidas, conforme a forma da árvore.

Código fora do subconjunto, tentativas de acesso ao host, laços não homologados e limites de análise produzem `pending`, `passed: false`, sem XP/conclusão/domínio. A tentativa e o código ficam registrados com evaluationStatus; a interface informa que será necessário o executor isolado de uma fase futura. Não se apresenta isso como prova de resposta incorreta. Erro de sintaxe ou divergência efetivamente analisável produz `failed`. Uma resposta homologada ou uma análise de constantes que satisfaça todos os critérios produz `verified`.

## Arquivos

Alterados:

- `app/api/progress/route.ts`
- `components/training-workspace.tsx` — comportamento de envio e resultados; sem alteração de markup/layout.
- `lib/app-state.tsx`, `lib/progress.ts`
- `services/sync/progress-policy.ts`, `services/sync/progress-sync.ts`
- `prisma/schema.prisma`
- `scripts/phase2-test-server.cjs`, `scripts/run-security-tests.ps1`
- `package.json`, `package-lock.json`
- `next.config.ts` — desativa apenas o cache Turbopack de filesystem em APP_ENV=test, evitando 404s espúrios na alternância de bancos/modos do harness.

Adicionados:

- `app/api/attempts/route.ts`, `app/api/attempts/hint/route.ts`, `app/api/attempts/claim/route.ts`
- `services/attempts/attempt-store.ts`, `services/attempts/progress-transition.ts`, `services/attempts/static-assessment.ts`
- `services/sync/official-progress-client.ts`
- `lib/initial-state.ts`, `lib/trusted-progress.ts`
- A migration indicada acima
- `tests/security/server-progress.test.ts`, `tests/e2e/server-progress.spec.ts`
- `playwright.phase3.config.ts`, este relatório

`services/gamification/progression.ts` e `mastery.ts` foram auditados e reutilizados; não foi necessário reescrevê-los. A identidade, verificação e isolamento das Fases 1 e 2 não foram revertidos.

## Temporários e consistência

Os scripts de edição/auditoria em `.tmp` foram ferramentas locais de trabalho e não são importados pela aplicação. O backup e os logs permanecem preservados. O mecanismo preexistente `serverDataDirectory` só usa `.tmp/<namespace>` quando um namespace explícito e válido é configurado em desenvolvimento/teste; APP_ENV=production/staging ignora esse namespace e usa `.data`. Isso é utilizado pelo harness de testes, não pelos arquivos de backup/edição.

Na retomada, um cache de desenvolvimento de testes passou a responder 404 para rotas existentes. O servidor afetado foi encerrado, apenas seu banco temporário identificado por marcador foi removido e o cache `.next-test` foi **preservado** em `.tmp/phase3-preserved-next-cache-…`. O servidor comum do usuário e `loglab` não foram encerrados nem recriados. A rodada seguinte voltou a reconhecer as rotas.

O problema reapareceu ao trocar o modo de e-mail do harness; o cache de filesystem do Turbopack foi desabilitado exclusivamente em APP_ENV=test, conforme a opção suportada pelo Next instalado. As suítes de autenticação e de progresso também foram separadas em processos para respeitar o limite real de verificação de e-mail por IP. Nenhum rate limit de aplicação foi relaxado.

Os testes usam bancos descartáveis `logiclab_phase2_test_<id>`, com validação do nome e marcador de propriedade antes da limpeza. O teste de falha transacional usa um trigger exclusivamente nesse banco, removido no finally. Não há sinalizador de falha artificial na aplicação nem trigger de teste em `loglab`.

## Resultados e pendências

- `npm run typecheck`: passou, sem erros.
- `npm run lint`: passou, sem erros.
- `npm run test:security`: **27 testes passaram**, nenhum ignorado; inclui as proteções das Fases 1/2 e a avaliação/reconciliação da Fase 3.
- `npx playwright test --config playwright.phase3.config.ts`: **8 testes passaram**. Cobrem autenticação, adulteração, primeira conclusão/repetição, idempotência, concorrência em duas abas, dicas/prática, nível/domínio, rollback real no PostgreSQL, logout/isolamento, respostas pendentes e submissão pelo editor.
- Regressão com `playwright.phase2.config.ts`: **13 passaram**. Os dois testes condicionais (demo e falha de provedor) foram executados separadamente nos modos correspondentes: **1 passou em cada modo**. Total: **23 cenários de integração/E2E distintos aprovados**; nenhum requisito obrigatório ficou sem execução.
- `tsc --listFilesOnly --pretty false`: nenhum arquivo de `.tmp` incluído na compilação. A busca de referências de runtime também não encontrou importação de ferramentas/backup temporários.
- Auditoria privada final de `loglab`, após encerrar os testes: dois usuários originais preservados, inclusive IDs, usernames, e-mails e hashes; zero tentativas, lançamentos de XP e UserProgress, como no backup. Três migrations aplicadas, nenhuma constraint inválida, duplicata de identidade, divergência de totais ou trigger de teste. Nenhum banco descartável restante. Backup legível por `pg_restore`.

Evidências preservadas em `.tmp/phase3-{typecheck-final,eslint-final,units-final,progress-final,phases12-regression,provider-final,demo-final,audit-verified,database-final}.log`. A última repetição dos oito testes de progresso passou em 1,2 minuto após a restrição final do analisador. Os testes escrevem somente em bancos descartáveis, não em `loglab`. O Next registrou avisos de filesystem lento e requisições abortadas/ECONNRESET durante navegação/encerramento, sem falha de teste. Nenhuma implementação ou validação obrigatória da Fase 3 ficou pendente; as limitações abaixo permanecem explícitas, sem avançar para a Fase 4.

Limitações de produto/segurança: avaliação geral de JavaScript e isolamento de execução ficam para outra fase; respostas corretas alternativas podem aguardar avaliação. Soluções/testes já existentes no bundle do navegador não foram ocultados nesta fase, portanto isto não é um mecanismo anticolagem/prova inviolável. Históricos oficiais extensos ainda ficam no snapshot JSON e precisarão de paginação/retenção em maior escala. Limites por IP continuam por processo; PostgreSQL garante unicidade/transações entre instâncias. Falta de PostgreSQL não permite concessão oficial; rascunhos continuam locais. Reinicie o servidor de desenvolvimento para carregar o Prisma Client após a migration. O erro preexistente do worker Monaco permanece fora do escopo.
