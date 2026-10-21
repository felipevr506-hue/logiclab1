# Fase 7 — Tutor conversacional

## Arquitetura

Antes, o workspace chamava `SocraticFallbackTutor` no navegador e salvava mensagens em estado local/backup da conta. Agora o painel chama `GET/POST /api/tutor/chat`. O servidor valida a sessão verificada, acesso ao exercício, formato e tamanho, reserva cota transacional no PostgreSQL, monta contexto por whitelist, chama o provider, valida a saída e grava o par aluno/Tutor atomicamente.

O adaptador usa a [Responses API com saída estruturada](https://developers.openai.com/api/docs/guides/structured-outputs). Não há SDK novo nem dependência adicionada: utiliza `fetch` no servidor. A credencial fica somente no header de autorização do servidor; não é enviada no contexto ou ao navegador. `store:false` é solicitado ao provider; outras condições de retenção dependem do contrato do serviço.

Não há chamadas automáticas de IA após uma tentativa oficial. Cada chamada é uma pergunta/ação explícita do aluno. Execução, tentativas, XP, nível e progresso não são modificados pelo chat.

## Configuração

No ambiente do servidor:

- `TUTOR_PROVIDER=openai` (provider implementado).
- `OPENAI_API_KEY`: configurar privadamente, sem prefixo `NEXT_PUBLIC_`.
- `TUTOR_MODEL`: identificador de um modelo disponível na sua conta que suporte saída JSON estruturada; nenhum modelo pago é escolhido automaticamente.
- `TUTOR_GLOBAL_DAILY_LIMIT`: opcional; padrão 100, teto 1.000 chamadas/reservas em 24 horas.
- `DATABASE_URL`: PostgreSQL já existente.

Nenhuma chave foi criada, instalada ou exposta. Sem chave/modelo, o painel informa que o Tutor não está configurado e mantém o exercício utilizável. Não há fallback local silencioso. `SocraticFallbackTutor` permanece no código e em testes, mas não responde no fluxo novo como se fosse IA online.

O provider fictício só pode funcionar com `NODE_ENV !== production`, `APP_ENV=test`, `TUTOR_PROVIDER=mock` e um banco com nome estrito de teste descartável. A interface o identifica como fictício. Os testes nunca chamam a API paga.

## Persistência e isolamento

Reutilizados `TutorMessage` e `TutorUsage`; **nenhuma migration**. Mensagens antigas não são removidas. A relação usuário/exercício define uma conversa. As consultas sempre usam o usuário da sessão; não aceitam `userId`, papéis, histórico, solução ou progresso do navegador.

Mensagens novas têm IDs estáveis do servidor. O cliente mescla por ID com o cache já isolado da conta. Mensagens locais antigas continuam visíveis conforme a Fase 6, com respostas completas de nível 5 ocultadas. Essas mensagens legadas não entram no contexto do modelo. O servidor lê somente mensagens emitidas pelo novo endpoint.

A interface busca as últimas 100 mensagens novas; registros anteriores continuam no banco. Para o modelo, a janela é de no máximo 12 mensagens e 7.000 caracteres, com resumo determinístico limitado a quantidade omitida, conceito e estágio de dicas. Não é enviado um resumo livre potencialmente inseguro de respostas antigas.

## Contexto e defesa pedagógica

O servidor seleciona título, objetivo, conceito, requisitos, código atual filtrado, nível/domínio oficiais, estágio de dica e comportamentos da última tentativa. Indica se a tentativa foi feita com o código atual. O erro do navegador é tratado como relato não verificado, nunca como resultado oficial.

Camadas:

1. Schema fechado de entrada: rejeita campos de solução, papéis e identidade/progresso forjados.
2. Contexto construído no servidor; não serializa `exercise.solution`, versões homologadas, objetos completos de tentativa, credenciais, e-mail ou dados de outra conta. Código já reconhecido como resposta válida é omitido do contexto. Padrões de credenciais e e-mail no texto/código são redigidos.
3. Regras pedagógicas no prompt, sem ferramentas, execução de código, acesso a arquivos ou ambiente.
4. Recusa prévia de pedidos diretos, equivalentes, codificados e extração em partes.
5. Saída JSON pequena seguida de filtro determinístico: código, blocos executáveis, fragmentos, ofuscação, semelhança com a referência, certas receitas equivalentes e acúmulo de trechos anteriores.
6. Em caso de risco, substituição por orientação parcial; o painel informa o ajuste pedagógico.

**Limite técnico:** filtros determinísticos e instruções de modelo reduzem risco, mas não oferecem prova de que toda paráfrase semântica possível será reconhecida. Podem também rejeitar explicações legítimas. A garantia implementada é falhar de forma conservadora nos padrões detectados e não expor tokens brutos antes da checagem. Novos ataques exigem ampliar os testes. A referência ainda existe no catálogo cliente anterior à Fase 7, conforme a ressalva da Fase 6; este trabalho impede seu envio pelo novo contexto, não torna o catálogo sigiloso.

## Limites e custo

- Mensagem: 2.000 caracteres; código: 12.000; erro relatado: 400; corpo HTTP lido por streaming com teto de 48.000 bytes.
- Provider: até 450 tokens de saída, resposta pedagógica até 700 caracteres, timeout de geração de 25 segundos, cancelamento com `AbortController`.
- Burst: 8 envios por usuário/minuto no processo.
- Cotas duráveis compartilhadas entre processos: FREE 5/24h e 40/30 dias; PRO 80/24h e 400/30 dias; global 100/24h por padrão e 1.000/30 dias. Contam reservas, inclusive falhas/cancelamentos, para limitar abuso e gasto incerto.
- Uma geração simultânea por usuário. Reservas são serializadas por advisory lock no PostgreSQL; a trava não fica aberta durante a chamada externa.
- `requestId` UUID + hash do payload, dono e exercício impedem duplicação de geração por replay. Repetição concluída devolve histórico; pendente/conflitante retorna 409. Reenvio explícito após erro usa novo ID e consome nova reserva.

Tokens reais retornados pelo provider ficam em `TutorUsage`. Não há estimativa monetária confiável sem preços do modelo escolhido: o campo legado de custo permanece sem cálculo. `AI_MONTHLY_BUDGET_IN_CENTS` não é usado como um orçamento financeiro pelo chat novo. Configure também limites financeiros na conta do provider; preço, disponibilidade, cobrança após cancelamento e retenção dependem dele.

## Interface

Mantidos painel recolhível, histórico, salvar explicação, feedback, mobile e editor da Fase 6. Campo multiline: Enter envia; Shift+Enter insere linha. Indicador de geração, interrupção, erro explícito e tentar novamente. O texto só é limpo após sucesso correspondente, evitando apagar uma nova pergunta digitada durante a espera.

Não há streaming bruto: a saída completa precisa passar pelo filtro antes de ser exibida. Cancelamento é de melhor esforço e não garante ausência de cobrança externa. A tentativa oficial e o editor continuam funcionando sem provider.

## Arquivos

Criados: `services/ai/chat-policy.ts`, `services/ai/chat-provider.ts`, `services/ai/chat-store.ts`, `app/api/tutor/chat/route.ts`, `components/exercise/use-tutor-chat.ts`, `tests/security/tutor-chat.test.ts`, `tests/e2e/tutor-chat.spec.ts`, `playwright.phase7.config.ts` e este relatório.

Alterados: `components/training-workspace.tsx`, `components/exercise/tutor-panel.tsx`, `components/exercise/workspace.module.css`, `.env.example`, `scripts/run-security-tests.ps1`, `playwright.phase6.config.ts` e `services/attempts/attempt-store.ts` (somente exporta a rotina de catálogo existente para reutilização; lógica de correção/recompensa intacta).

Backup lógico: `.tmp/phase7-before`; Git continua indisponível neste computador. Nenhum arquivo de credenciais foi incluído no backup. Landing, dashboard, navegação, autenticação, armazenamento por conta, executor e schema não foram alterados.

## Validação

Resultados finais: **40 testes unitários/segurança e 48 E2E distintos passaram**, sem falhas na rodada final. Logs e capturas em `.tmp/phase7-*`.

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Passou |
| `npm run lint` | 0 erros; 1 aviso preexistente em `app-shell.tsx:140` |
| `npm run test:security` | 40 passaram, incluindo 6 testes específicos do chat |
| Playwright Fase 2: autenticação e isolamento | 13 passaram |
| Playwright Fase 3: progresso oficial | 8 passaram |
| Playwright Fase 4: landing e entrada | 4 passaram |
| Playwright Fase 5: dashboard e navegação | 6 passaram |
| Playwright Fase 6: exercício desktop/mobile | 6 passaram |
| Playwright Fase 7: conversa, isolamento, segurança e falhas | 8 passaram |
| Fase 7 sem configuração de IA | 1 passou |
| Fase 2 com falha do provedor de e-mail | 1 passou |
| Fase 1 com demo explicitamente habilitado | 1 passou |

Os três cenários condicionais são pulados nas rodadas de configuração normal e foram executados separadamente com a configuração correspondente; nenhum ficou sem execução. Os comandos E2E usam `playwright test --config=playwright.phaseN.config.ts`, com as variantes registradas em `.tmp/run-phase7-validation.cjs`. Não foi feita chamada paga nem teste de qualidade com modelo real.

Capturas desktop e mobile foram inspecionadas; permanecem editor utilizável, painel recolhível e abas mobile, sem transbordamento horizontal no teste. A auditoria de escopo confirmou que o serviço de tentativas é idêntico ao backup, exceto pela exportação da função de catálogo, e que a aplicação não importa arquivos temporários.

Auditoria final do `loglab`: 2 usuários, 1 tentativa, 4 transações de XP e 1 registro de progresso; as 3 migrations anteriores continuam aplicadas. IDs, nomes, e-mails e hashes originais foram preservados. Sem constraints inválidas, identificadores conflitantes, totais inconsistentes ou bancos temporários restantes. Os testes usam bancos descartáveis separados.

A primeira execução detectou serialização do tipo `void` da trava PostgreSQL pelo Prisma; a consulta agora retorna texto. Uma rodada de regressão encontrou `EPERM` no rename de telemetria do Windows e foi repetida sem alterar autenticação; a repetição completa passou.

Pendências externas: credencial/modelo reais e orçamento do provider; validação contratual de retenção e testes de qualidade com o modelo escolhido, fora dos testes pagos automáticos. Persistem o aviso preexistente do ESLint em `app-shell.tsx` e a manutenção da suíte monolítica legada `site.spec.ts`; são usadas as suítes específicas das Fases 1–7.
