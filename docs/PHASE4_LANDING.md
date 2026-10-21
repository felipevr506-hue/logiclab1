# Fase 4 — landing e entrada

## Escopo e arquitetura

A landing passou de **16 para 6 seções**, redução líquida de dez. A contagem anterior inclui 15 tags section no componente principal e uma no PublicCodeDemo.

Foram retirados 12 blocos originais: problema, treino diário, trilha detalhada, feedback demonstrativo, demo executável, editor detalhado, progressão, ecossistema de recursos, comparação, demonstração dedicada do Tutor, preços e bloco social. Hero, como funciona, FAQ e CTA foram reescritos; benefícios e uma única prévia compacta passaram a concentrar a apresentação do produto.

Nova ordem:

1. Hero com headline curta, proposta e links de cadastro/login.
2. Três benefícios com descrições curtas.
3. Uma prévia ilustrativa de código, saída e orientação, claramente identificada, sem executar código ou simular concessão de progresso.
4. Três passos para começar.
5. CTA final.
6. FAQ com três perguntas.

O componente deixou de depender do estado de progresso, treino diário, preços, editor/executor e efeitos animados. ProductPreview e StartLink são pequenas funções no mesmo arquivo, sem hierarquia de abstrações. A composição é renderizada no servidor; cookies tornam a rota dinâmica e a sessão decide apenas o destino de continuidade. Nenhum e-mail, token, nome de conta ou progresso é passado à landing.

O tema escuro/verde foi preservado com CSS Module próprio, grids responsivos e controles de pelo menos 48px nos CTAs. Nenhum estilo novo é global. A remoção no CSS global é restrita a seletores da demonstração pública aposentada; seletores compartilhados de telas internas permanecem. A landing respeita movimento reduzido, tem link para pular ao conteúdo e FAQ nativo com details/summary. A preferência de tema dentro do aplicativo não foi alterada.

## Fluxos

- Visitante: `/` → Começar grátis → `/cadastro` → `/confirmar-email` → confirmação explícita → `/onboarding` → aplicativo.
- Conta existente: `/` → Já tenho uma conta → `/entrar` → aplicativo (ou onboarding ainda pendente).
- Sessão autenticada na landing: “Continuar aprendendo” vai a `/confirmar-email`, `/onboarding` ou `/dashboard`, conforme confirmação e onboarding persistidos. Não há CTA de cadastro para essa sessão.
- A proteção de onboarding e a validação de next continuam nos módulos anteriores, sem reimplementação. O teste cobre next interno com query, URLs externas, protocolo relativo, barra invertida e retorno recursivo ao login.

## Arquivos

- app/page.tsx: consulta da sessão e destino de continuidade.
- components/landing-page.tsx: conteúdo simplificado, sem dependência de app-state ou executor.
- components/landing-page.module.css: estilos exclusivos da landing.
- components/public-code-demo.tsx: removido porque não é mais utilizado.
- app/globals.css: remoção de estilos exclusivos dessa demonstração.
- tests/e2e/landing-entry.spec.ts: nova cobertura de entrada, responsividade e next.
- playwright.phase4.config.ts: reutiliza o harness de PostgreSQL descartável das fases anteriores.
- tests/e2e/account-isolation.spec.ts: expectativa do CTA atualizada para cadastro; as verificações de isolamento permanecem.
- tests/e2e/site.spec.ts: teste da landing atualizado, sem exigir menu de marketing/tema antigos.
- tests/e2e/new-features.spec.ts: testes deixam de exigir Matrix Rain e seções retiradas.
- Este relatório.

Backup dos arquivos preexistentes em `.tmp/phase4-before`. Git não está disponível nesta máquina. Nenhuma migration ou credencial foi alterada; os testes não gravaram em loglab. Autenticação, confirmação local de e-mail, onboarding, progresso, dashboard, menu lateral, Tutor e gamificação não foram reimplementados.

## Verificações

O primeiro teste mobile tentou tratar o primeiro Tab como foco da landing, mas o portal de ferramentas do Next em desenvolvimento recebe esse Tab. Aguardar a hidratação não bastou; o teste foi corrigido para focar o link de pular conteúdo e testar sua ativação pelo teclado, sem modificar o provider ou desativar ferramentas do Next. Os outros três cenários passaram nas rodadas de diagnóstico.

- Typecheck e ESLint passaram.
- `npm run test:security`: 29 testes passaram, nenhum ignorado, incluindo isolamento, e-mail e regras de progresso da Fase 3.
- `playwright.phase4.config.ts`: quatro testes passaram na rodada final (58,2s), cobrindo visitante, CTAs, FAQ/teclado, larguras 320/390/768/1440, sessão não confirmada/confirmada/onboarded, login e cinco destinos de next.
- As capturas finais `.tmp/phase4-desktop.png` e `.tmp/phase4-mobile.png` foram inspecionadas. A prévia e os CTAs se adaptam a uma coluna no mobile. Não houve overflow horizontal nas quatro larguras.
- Auditoria estrutural com PostCSS: todas as 1.985 regras globais alheias à demonstração pública permaneceram idênticas. Foram removidas ou limpas 17 regras que continham seletores da demonstração, preservando os seletores compartilhados.
- Regressão com `playwright.phase2.config.ts`: 13 testes passaram em 1,9 minuto, incluindo isolamento, bloqueio de usuários não confirmados, expiração/reenvio, cadastro pela interface com confirmação local persistente e recuperação/revogação de sessões. Os cenários condicionais de demo e provedor indisponível usam rodadas separadas.
- Regressão com `playwright.phase3.config.ts`: oito testes passaram em 2,2 minutos. Primeira conclusão, repetição, reenvio idempotente, duas abas simultâneas, XP adulterado, dicas/prática, nível/domínio, rollback, isolamento e submissão real pelo editor continuam corretos.
- Provedor de e-mail indisponível: um teste passou na rodada separada (34,2s); a conta segue não verificada, sem fallback e com reenvio HTTP 503.
- Demo explicitamente habilitado: um teste passou na rodada separada (30s), mantendo a identidade de teste isolada e 0 XP inicial. O fluxo normal continua sem demo automático.
- Total: **29 testes unitários/segurança e 27 cenários de integração/E2E distintos aprovados**. Os dois skips condicionais da suíte principal foram cobertos pelas rodadas correspondentes. A suíte geral de funcionalidades fora deste escopo não foi executada inteira.
- Auditoria final somente leitura de loglab: dois usuários originais preservados (IDs, usernames, e-mails e hashes), três migrations anteriores aplicadas, nenhuma constraint inválida, duplicata de identidade, divergência entre XP e ledger ou trigger de teste. Há progresso real no banco (uma tentativa, quatro lançamentos de XP e um UserProgress), que não foi removido ou convertido. Nenhum banco descartável restante.
- `tsc --listFilesOnly --pretty false`: nenhum arquivo dentro de .tmp incluído na compilação.

Evidências em `.tmp/phase4-{typecheck-final,eslint-final,units,landing-complete,css-audit,auth-regression,progress-regression,email-failure,demo-regression,database-audit}.log`. Todos os testes PostgreSQL usam bancos descartáveis com marcador de propriedade, sem escrita em loglab. Os avisos preexistentes do worker Monaco, requisições abortadas do Next e filesystem lento não impediram a aprovação das rodadas finais.

## Limitações

A prévia é ilustrativa, sem editor executável nem chat interativo; as funcionalidades reais continuam dentro do produto. A responsividade foi conferida em Chromium com viewport de 320, 390, 768 e 1440px; isso não substitui verificação em todos os aparelhos/navegadores. A landing depende da sessão no servidor para decidir o CTA, portanto não é exportada como HTML estático independente de sessão. Nenhum requisito obrigatório desta fase ficou pendente. Fase 5 não iniciada.
