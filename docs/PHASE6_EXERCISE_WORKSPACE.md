# Fase 6 — tela de exercício

## Escopo e retomada

A inspeção inicial encontrou a tela anterior intacta. Na segunda retomada, os componentes já estavam extraídos, o Tutor era recolhível e quatro cenários de navegador estavam em validação. Essas alterações foram preservadas; a continuação ajustou a escala de leitura e o carregamento local do worker do Monaco, completou cobertura e verificações.

Git não está disponível neste computador. Backup lógico dos arquivos existentes alterados: `.tmp/phase6-before`. Nenhuma migration, alteração no schema ou escrita de teste em `loglab` foi necessária.

## Antes e depois

Antes: quatro etapas obrigando alternância entre conceito, prática, desafio e correção; três painéis permanentes; exemplo de nota repetido em exercícios diferentes; versões, opções e console expostos; correção e Tutor podiam fornecer a resposta completa após tentativas/pistas.

Depois: problema e editor na mesma tela desde a abertura. Objetivo, requisitos e exemplo do próprio exercício ficam no problema; conceito e dicas são expansíveis. O Monaco ocupa a maior área e continua com modo foco. Versões, ferramentas, opções, detalhes e feedback ficam em áreas secundárias. Não há porcentagem artificial de treino em andamento nem estimativa incorreta de desconto de XP por dica.

Desktop: Tutor fechado inicialmente, com Abrir Tutor/Fechar Tutor. Ao abrir, ocupa a lateral; em desktops menores usa painel sobreposto à direita. Fechar devolve espaço ao editor, sem apagar a conversa. Mobile: Problema, Código e Tutor, com navegação por teclado e um painel por vez. Quando a execução/envio termina no mobile, o resultado é trazido para a área visível.

## Execução e resultados

- **Executar / Ctrl+Enter:** prévia no navegador, sem tentativa oficial ou recompensa, preservando a distinção da Fase 3.
- **Enviar resposta / Ctrl+Shift+Enter:** usa o mesmo `recordAttempt` e `/api/attempts`, com identidade, idempotência e transação existentes.
- O resumo diferencia aprovação oficial, falha de comportamento, erro e validação pendente. Console e cenários completos ficam em detalhes. Tentativas anteriores continuam no histórico do Tutor; versões de código continuam nas ferramentas.
- Uma resposta pendente não é convertida em erro de execução para o Tutor. Não recebe XP e permanece sujeita às limitações da análise estática da Fase 3.

## Pedagogia

Removidas as etapas com código de referência, o botão de solução no painel de dicas e a solicitação de solução no Tutor. O serviço local também recusa `request-solution`, mesmo com todas as dicas e muitas tentativas. O workspace não entrega mais a referência ao contexto do Tutor.

Mensagens antigas de nível 5 permanecem armazenadas, mas seu conteúdo é substituído por um aviso na tela de exercício e não pode ser salvo pelo botão de explicações. Outras mensagens, perguntas, dicas e feedback foram preservados.

Isso controla a interface pedagógica. O catálogo atual ainda inclui referências no código distribuído ao navegador; não se trata de sigilo contra inspeção do bundle. Separar esse catálogo exigiria outro escopo. Código e notas que o próprio aluno salvou anteriormente não foram apagados.

## Arquivos

Alterados:

- `components/training-workspace.tsx` — controlador existente e composição da tela; de 2.100+ para cerca de 800 linhas.
- `components/local-monaco-editor.tsx` — base absoluta na mesma origem para os workers locais, sem CDN.
- `services/ai/tutor.ts` — somente a política local de não entregar solução; nenhuma integração externa.
- `scripts/run-security-tests.ps1` — inclui o teste pedagógico.

Adicionados:

- `components/exercise/problem-panel.tsx`
- `components/exercise/results-panel.tsx`
- `components/exercise/result-details.tsx`
- `components/exercise/tutor-panel.tsx`
- `components/exercise/feedback-panel.tsx`
- `components/exercise/workspace.module.css`
- `tests/security/tutor-pedagogy.test.ts`
- `tests/e2e/exercise-workspace.spec.ts`
- `playwright.phase6.config.ts`
- este relatório.

Não foram alterados autenticação, armazenamento por conta, provider de progresso, APIs de correção/tentativas, regras de XP, migrations, landing, dashboard ou navegação.

## Verificação

Resultados finais:

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Passou |
| `npm run lint` | 0 erros; 1 aviso preexistente |
| `npm run test:security` | 34 testes passaram |
| `playwright.phase2.config.ts` | 13 passaram; 2 casos condicionais executados separadamente |
| `playwright.phase3.config.ts` | 8 passaram |
| `playwright.phase4.config.ts` | 4 passaram |
| `playwright.phase5.config.ts` | 6 passaram |
| `playwright.phase6.config.ts` | 6 passaram |
| Falha de e-mail, configuração da Fase 2 com `--grep provider` | 1 passou |
| Demo explícito, configuração da Fase 1 com `--grep explicit` | 1 passou |

Total: **39 cenários distintos de integração/E2E aprovados**, além dos 34 testes unitários. Os seis cenários do workspace verificam abertura, Tutor recolhível e feedback ao reabrir, modo foco, prévia com erro, falha oficial, pendência, aprovação, repetição sem duplicar XP, todas as dicas sem liberar solução, mobile, rascunhos/conversa A → B → A, ocultação de respostas completas antigas sem apagar registros e as rotas do catálogo. Não houve erro JavaScript não tratado nas páginas desses seis testes.

As primeiras rodadas expuseram duas suposições incorretas no teste: o indicador “pensando” era contado como resposta pronta e a conta de teste não possuía calendário/plano compatíveis com todas as rotas. As esperas passaram a exigir mensagens concluídas e persistidas; o cenário de rotas usa conta antiga com assinatura ativa somente no PostgreSQL descartável, com validação estrita do nome do banco. Os bloqueios reais não foram alterados.

Validação visual em Chromium desktop (1440 × 1000) e mobile (390 × 844), com capturas inspecionadas. O último ajuste corrigiu overflow do conteúdo do Tutor e possui asserção no navegador. Logs e capturas estão em `.tmp/phase6-*`; a aplicação não importa esses arquivos. Logs também incluem falhas induzidas de transação/provedor e um cancelamento HTTP `ECONNRESET` durante encerramento de contexto de teste, sem falha funcional nas verificações finais.

Auditoria de leitura de `loglab`: 2 usuários, 1 tentativa, 4 transações de XP e 1 registro de progresso, preservados. Três migrations anteriores aplicadas, sem constraints inválidas, identidades duplicadas ou divergência nos totais de XP. Os bancos descartáveis pertencentes aos testes foram removidos após o término; dados reais não foram apagados.

Limitações preservadas: respostas corretas fora das formas homologadas/análise estática ainda podem ficar pendentes; esta fase não adiciona executor no servidor. O ESLint mantém um aviso anterior em `app-shell.tsx:140`, não modificado nesta fase. A antiga suíte monolítica `site.spec.ts` contém expectativas anteriores às fases atuais, incluindo liberação de solução, e não foi usada como validação desta entrega; a cobertura aplicável está nas suítes específicas das Fases 1–6. Sua atualização integral permanece uma manutenção de testes separada.
