# Fase 5 — dashboard e navegação

## Antes e depois

O dashboard anterior combinava aviso de demonstração, saudação, meta diária estimada, quatro métricas, missão, projeto, recomendação, plano semanal, treino, revisão, programação diária completa, mapa de consistência, nível/recompensa e outra chamada para a trilha. Várias ações competiam com o próximo passo do iniciante.

O dashboard novo tem uma hierarquia curta:

1. Saudação com o primeiro nome da conta autenticada.
2. Um único CTA principal: “Começar minha primeira aula” ou “Continuar de onde parei”.
3. Dois cards secundários: trilha e treino do dia.
4. Uma faixa discreta com sequência, atividade real, nível e XP.
5. Uma recomendação somente quando há evidência oficial de habilidade; conta nova não recebe recomendação de revisão artificial.

Não há mapa de atividade, contagem de revisão fixa, demonstração automática ou cronômetro/tempo estudado inventado. “Cerca de X min” é estimativa do conteúdo, explicitamente distinta de tempo já estudado. Zero XP, zero conclusões e nenhuma atividade são estados legítimos de conta nova. Nome ausente usa saudação genérica, sem inventar uma pessoa.

## Continuidade

`lib/dashboard-view.ts` é um seletor de apresentação, sem mutações ou persistência. Usa as tentativas, conclusões e ledger oficiais já carregados pelo provider:

- Sem tentativas/conclusões, começa pelo primeiro item da sequência pedagógica, mesmo que a conta seja antiga e o treino diário já tenha girado.
- Com progresso, retoma a tentativa oficial mais recente da trilha que esteja incompleta e liberada. Tentativas de prática livre/projeto/prova não desviam a continuidade da trilha.
- Sem tentativa incompleta, escolhe a primeira aula liberada ainda não concluída.
- Se todas as aulas disponíveis estiverem concluídas, aponta para a trilha e informa a data da próxima liberação; não leva a uma aula bloqueada.
- Se a trilha estiver toda concluída, oferece prática.

XP e domínio não são concedidos ou mesclados aqui. Nível e sequência usam as funções de leitura anteriores sobre dados oficiais. As fórmulas, bloqueios, idempotência, APIs, migrations e transações da Fase 3 permanecem iguais.

O provider ganhou apenas `officialProgressAvailable`, um status de apresentação definido quando a leitura/aceitação oficial existente tem sucesso. Isso evita mostrar “conta nova” com zero XP quando o servidor está indisponível, inclusive com um snapshot local antigo contendo a data de início. Não adiciona requisições, campos persistidos ou uma nova autoridade de progresso. O demo continua sendo exceção explicitamente configurada, conforme a Fase 1.

## Menu

Antes eram 19 destinos de aprendizagem no mesmo nível (18 fixos e treino do dia), além de quatro destinos de conta e Admin quando autorizado. Também havia cartões de nível e sequência competindo com os links, incluindo cinco dias marcados artificialmente.

Agora a navegação principal contém exatamente:

| Nome | Rota preservada |
| --- | --- |
| Início | /dashboard |
| Minha trilha | /trilha |
| Praticar | /praticar |
| Meu progresso | /evolucao |

“Explorar” reúne treino do dia, linguagens, habilidades, recompensas/conquistas, laboratório, playground, missões, projetos, portfólio, relatório semanal, prova, revisão, caderno, atividade e glossário. “Conta” reúne perfil, segurança, assinatura, ajuda e Admin somente para o papel autorizado. Perfil e logout permanecem acessíveis no rodapé.

Nenhuma rota foi removida. O grupo correspondente se abre no acesso direto, destaca a rota ativa com aria-current e continua permitindo expandir/recolher manualmente. Os grupos não salvam estado compartilhado entre contas. Plano, permissões e recursos premium mantêm suas restrições anteriores.

No mobile, o menu fechado não recebe foco. Ao abrir, move o foco para fechar, mantém Tab dentro do menu, fecha com Escape ou navegação e devolve o foco ao botão. O scroll do documento é restaurado ao fechar. O limite responsivo existente de 1360px foi respeitado. A posição de scroll do menu e o logout continuam usando a limpeza anterior de sessão.

## Dados artificiais removidos

- Fallback “Alex” no dashboard e iniciais fictícias “AL” no shell.
- Aviso incondicional de ambiente de demonstração.
- Revisão fixa “2” e prioridades/conceitos sem evidência.
- Heatmap gerado por uma sequência fixa de intensidades.
- Cinco dias da semana marcados como feitos no menu.
- Meta diária que convertia conclusão em minutos estudados sem medição.
- Roteiro com etapa “Aprenda” já marcada como concluída para qualquer conta.
- Projeto “atual”, recompensa e plano semanal apresentados como prioridades automáticas no dashboard. Esses recursos continuam nas páginas existentes.

## Arquivos

Alterados:

- components/dashboard.tsx
- components/app-shell.tsx
- lib/app-state.tsx — somente status de disponibilidade para apresentação.
- scripts/run-security-tests.ps1 — inclui o novo seletor nos testes.
- tests/e2e/site.spec.ts — expectativas de menu/plano antigo atualizadas.

Adicionados:

- components/dashboard.module.css
- components/student-navigation.tsx
- components/student-navigation.module.css
- components/app-shell.module.css
- lib/dashboard-view.ts
- tests/security/dashboard-view.test.ts
- tests/e2e/dashboard-navigation.spec.ts
- playwright.phase5.config.ts
- Este relatório.

Backup lógico dos arquivos anteriores em .tmp/phase5-before. Git não está disponível nesta máquina. Landing, confirmação de e-mail, rotas, Tutor, executor, correção, schema Prisma e regras de recompensas não foram alterados. Nenhuma migration criada.

## Testes e limites

Typecheck e ESLint passaram. A nova suíte de dashboard passou nos seis cenários (rodada final: 43s), e a suíte unitária/segurança passou em 33 testes, nenhum ignorado. As capturas .tmp/phase5-dashboard-desktop.png, .tmp/phase5-dashboard-mobile.png e .tmp/phase5-menu-mobile.png foram inspecionadas. As larguras de 320, 390, 768 e 1440px não apresentaram overflow horizontal no dashboard.

- Regressão das Fases 1/2: 13 testes passaram em 1,1 minuto, com dois cenários condicionais reservados às rodadas correspondentes. Inclui confirmação local de e-mail persistente e troca/logout de contas.
- Regressão da Fase 3: oito testes passaram em um minuto, incluindo concorrência, rollback, segurança e submissão pelo editor.
- Regressão da Fase 4: quatro testes passaram em 31,1s, cobrindo landing, cadastro/login, confirmação/onboarding, continuidade autenticada e next seguro.
- Falha de provedor de e-mail: um teste passou em 17,5s, mantendo confirmação pendente e reenvio HTTP 503, sem link indevido.
- Demo explicitamente habilitado: um teste passou em 14,7s. A identidade de teste continua isolada e começa em 0 XP; o modo normal não entra automaticamente nela.
- Auditoria por comparação com backup: o provider é idêntico ao anterior após retirar apenas as linhas que expõem o status de leitura oficial. Políticas, sincronização, gravações e recompensas permanecem iguais.
- Auditoria somente leitura de loglab: dois usuários originais preservados; uma tentativa, quatro lançamentos de XP e um UserProgress existentes mantidos; três migrations anteriores aplicadas, nenhuma constraint inválida, duplicata de identidade, divergência no ledger ou trigger de teste. Nenhum banco descartável restante.

Total final: **33 testes unitários/segurança e 33 cenários de integração/E2E distintos aprovados**. Os dois skips condicionais da suíte principal foram cobertos nas rodadas específicas. Nenhum requisito obrigatório da Fase 5 ficou pendente. Os logs ficam em `.tmp/phase5-{typecheck-final,eslint-final,units,dashboard-final,auth-regression,progress-regression,landing-regression,email-failure,demo-regression,provider-audit,database-audit,changes}.log`. Nenhum arquivo de .tmp entrou na lista de arquivos compilados pelo TypeScript. Os avisos preexistentes do worker Monaco e do filesystem lento não impediram a aprovação das suítes.

O teste de conta com progresso cria uma conta histórica exclusivamente no banco descartável, registra tentativas pelas APIs oficiais, troca A → logout → B → logout → A e confere continuidade/XP corretos após recarregar. O teste de servidor indisponível reaproveita um snapshot local já existente para assegurar que sua data em cache não seja confundida com leitura oficial bem-sucedida. O acesso direto e os quinze links avançados são verificados com sessão real, sem bypass de planos/permissões.

Não há validação visual em todos os navegadores/aparelhos nem auditoria completa de leitor de tela nesta fase; foram usados Chromium, tamanhos responsivos e teclado. A suíte geral de funcionalidades antigas fora deste escopo não é executada inteira. Não foi iniciada a Fase 6.
