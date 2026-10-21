# Confirmação de e-mail local — correção da Fase 2

## Diagnóstico

A configuração efetiva lida dos arquivos de ambiente e do processo de auditoria não contém AUTH_EMAIL_DELIVERY, RESEND_API_KEY, AUTH_EMAIL_FROM ou NEXT_PUBLIC_APP_URL. APP_ENV também não está definido. Nenhum segredo foi impresso ou alterado. Sem chave/remetente não existe envio real; em `next dev`, NODE_ENV é development e o serviço já devolvia um link local, marcado como não enviado. A URL base ausente impede envio real, mas não impede o link local relativo.

O link era consumido e removido de sessionStorage pela primeira renderização de “Confirme seu e-mail”. Ao recarregar/retornar, a tela voltava à mensagem genérica sobre caixa de entrada/spam, sem recuperar aquele link. O reenvio também não persistia a nova resposta. Isso foi corrigido sem confirmar automaticamente usuários.

## Comportamento

- Sem chave do Resend, em desenvolvimento/teste local, o modo ausente, console, development ou resend oferece link de desenvolvimento. Espaços em uma chave vazia também contam como ausência.
- Uma chave configurada seleciona envio real; modo console/development antigo não força fallback. Remetente ou URL ausente/inválido e falha do provedor retornam falha, nunca link alternativo. Provedor desconhecido explícito também falha.
- NODE_ENV=production sempre impede fallback, mesmo com APP_ENV=development. APP_ENV=production/staging também impede recursos locais. A resposta pública libera o link apenas em localhost/127.0.0.1/::1; o componente também impede sua renderização em build de produção.
- Links permanecem em sessionStorage com a chave já separada por conta, são substituídos no reenvio e continuam sendo limpos pelo logout/troca de identidade. Não foi alterada a política de isolamento da Fase 1.
- A pessoa precisa abrir o link e clicar em “Confirmar meu e-mail”. “Continuar para o aplicativo” faz uma navegação completa por /confirmar-email: o servidor relê a mesma sessão e encaminha para onboarding ou dashboard. Sem sessão, pede login.
- Expiração, uso único, substituição de token, limites de reenvio e bloqueio de usuários não verificados permanecem no servidor, sem alterações.

## Como usar localmente

Execute `npm run dev`. Na configuração atual não é necessário acrescentar chave, remetente ou URL para usar o link local. Caso tenha definido APP_ENV=production/staging, use APP_ENV=development somente no ambiente local e reinicie o servidor; nunca use isso para contornar configuração de produção.

Cadastre-se e, na tela “Confirme seu e-mail”, clique em “Abrir confirmação local de desenvolvimento”, depois em “Confirmar meu e-mail” e “Continuar para o aplicativo”. Para conta já existente, entre nela e clique em “Reenviar confirmação”; aguarde o cooldown caso necessário. Não é preciso criar outra conta. Nenhum e-mail chega à caixa de entrada nesse modo: isso fica explícito na tela.

## E-mail real

Configure, fora do código, AUTH_EMAIL_DELIVERY=resend, uma RESEND_API_KEY válida, AUTH_EMAIL_FROM com remetente autorizado pelo provedor e NEXT_PUBLIC_APP_URL com a URL acessível do aplicativo (HTTPS fora de localhost). Em produção mantenha APP_ENV=production e NODE_ENV=production. Reinicie o processo após alterar ambiente. Nenhuma credencial foi criada ou preenchida nesta correção.

O sucesso significa que o provedor aceitou o envio e devolveu recibo; não garante entrega na caixa de entrada. Os testes de provedor são mocks locais, sem chamadas externas nem credenciais reais.

## Arquivos

- services/email/auth-email.ts: seleção do provedor/fallback e projeção pública sem link em produção.
- lib/auth-delivery.ts: leitura persistente do aviso da conta, sem consumir o link.
- components/email-verification.tsx: persistência após reenvio, proteção de renderização e continuação com sessão existente.
- tests/security/auth-lifecycle.test.ts: matriz de ambiente/provedor, falha sem fallback e sanitização pública.
- tests/e2e/auth-lifecycle.spec.ts: cadastro, recarga, reenvio, nova recarga, confirmação, continuação com o mesmo ID e login.
- playwright.phase2.config.ts: testes normais sem modo de entrega explícito; modo de falha usa provedor explicitamente indisponível, sem credenciais fictícias.
- Este relatório. Backup lógico dos seis arquivos anteriores em .tmp/email-confirmation-before.

Nenhuma migration, configuração de credenciais, dado de loglab, regra de progresso, landing, dashboard, navegação ou Tutor foi alterado. Fase 4 não iniciada.

## Validação

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run test:security`: 29 testes passaram, incluindo as regras de progresso da Fase 3 e a matriz de e-mail em desenvolvimento/produção.
- Playwright com `playwright.phase2.config.ts`: 13 testes passaram em 2,7 minutos. O fluxo de UI exercitou recarga antes/depois do reenvio, confirmação explícita, continuação com o mesmo ID e login. Expiração, cooldown, limites por hora e bloqueio de conta não verificada passaram nos cenários existentes.
- Dois cenários são condicionais nessa configuração: demo explícito (fora deste ajuste) e falha do provedor (rodada separada). Não houve falha nessa rodada.
- A rodada separada de provedor indisponível passou: 1 teste em 36,3 segundos; conta permanece não verificada, nenhum link local e reenvio retorna 503. Total desta correção: 14 cenários de integração/E2E aprovados. A primeira tentativa de selecionar esse cenário com um filtro contendo espaços não encontrou testes; o filtro simples `--grep provider` executou o cenário corretamente.
- Auditoria final somente leitura de loglab: dois usuários originais preservados; três migrations já existentes aplicadas; nenhuma constraint inválida, duplicata de identidade, inconsistência de totais ou trigger de teste. Nenhum banco de teste restante.

Logs em .tmp/email-{typecheck,eslint,unit-tests,e2e,provider-failure-e2e,database-audit}.log. As chamadas ao Resend nos testes unitários são interceptadas por mocks: foram testados recibo, rejeição e ausência de recibo, sem envio real. Os testes de navegador usam PostgreSQL descartável identificado por marcador, nunca loglab. Os avisos existentes de worker Monaco, filesystem lento e requisições abortadas do Next não causaram falhas nos testes.
