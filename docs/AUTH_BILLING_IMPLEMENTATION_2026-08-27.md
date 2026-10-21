# Relatório de autenticação e billing — 27/08/2026

## Resultado

O fluxo foi implementado para usar PostgreSQL como fonte de verdade em produção e Hotmart como provedor de billing. O modo local continua disponível somente em desenvolvimento/testes. Nenhuma tela de retorno, valor vindo do navegador ou alteração de `localStorage` concede Premium.

O código está pronto para homologação integrada, mas a ativação real em produção depende das credenciais e configurações externas listadas ao final. Sem elas, o checkout responde com indisponibilidade explícita e não simula pagamento.

## Login e cadastro

### O que já existia

- autenticação própria com senha derivada por scrypt;
- sessão em cookie HttpOnly;
- login, logout, recuperação, redefinição, troca de senha/e-mail, sessões e exclusão;
- store em arquivo para uma única instância de desenvolvimento;
- páginas básicas e proteção parcial de rotas.

Não havia Supabase no projeto, portanto nenhum segundo sistema foi criado e nenhuma integração Supabase foi simulada.

### O que foi corrigido ou adicionado

- runtime de produção migrado para Prisma/PostgreSQL; o fallback em arquivo é aceito apenas em desenvolvimento/teste;
- sessão persistente server-side, cookie `__Host-`/Secure em produção, SameSite e tokens armazenados somente como hash;
- cadastro com nome, e-mail, senha, confirmação, aceite obrigatório, versão dos Termos/Privacidade e timestamp persistido;
- senha validada no cliente e no servidor, com requisito prático de 10–128 caracteres, letra e número;
- resposta neutra para recuperação, token aleatório de uso único com 30 minutos e revogação das sessões ao redefinir;
- verificação de e-mail com token de uso único por 24 horas e entrega real via Resend quando configurado;
- troca de e-mail zera a verificação e envia nova confirmação;
- onboarding persistido com experiência, objetivo, tempo, idioma e linguagem inicial;
- redirecionamento seguro para o destino original e bloqueio de open redirect;
- proteção server-side para área autenticada e Admin; onboarding incompleto é redirecionado;
- telas responsivas e acessíveis de login, cadastro, recuperação e nova senha, com idioma PT-BR/EN e estados de loading;
- Google não é exibido porque não há OAuth configurado.

## Checkout e assinatura

### Provedor e arquitetura

- provedor: Hotmart;
- camada desacoplada: `BillingService`/`HotmartBillingService`;
- catálogo único de planos em `services/payments/plans.ts`;
- Premium mensal: BRL 3.990 centavos, formatado regionalmente como R$ 39,90;
- frontend envia somente `planId`; preço, status e permissões são definidos no servidor;
- contexto opaco de checkout vinculado ao usuário pelo parâmetro Hotmart `sck`, sem PII na URL;
- idempotência no clique e no banco evita múltiplos contextos ativos/pedidos por clique duplo.

### Webhook e estados

Endpoint: `POST /api/webhooks/billing`.

O endpoint lê o corpo bruto, limita o payload, valida `X-HOTMART-HOTTOK` com comparação resistente a timing, restringe produto/oferta, exige contexto conhecido no primeiro evento e registra hash/ID único antes de processar.

Mapeamento interno implementado:

- `PURCHASE_APPROVED`/`PURCHASE_COMPLETE` → `ACTIVE`;
- boleto → `PENDING`;
- atraso/protesto → `PAST_DUE`;
- cancelamento → `CANCELED`;
- expiração → `EXPIRED`;
- reembolso/chargeback → `REFUNDED`.

Eventos repetidos não repetem ativação. Um mesmo ID reapresentado com payload diferente é rejeitado. A atualização de assinatura, pagamento, checkout, webhook e analytics ocorre em transação.

### Liberação e gestão

- Premium é derivado no backend somente de assinatura `ACTIVE` ou `CANCELED` ainda dentro do período pago;
- retorno `/checkout/sucesso` apenas consulta/polling do backend;
- páginas de sucesso, confirmação, pendência, falha e cancelamento não alteram assinatura;
- “Meu plano” mostra plano, estado, preço, ciclo, próxima data/fim do acesso;
- cancelamento usa a API oficial da Hotmart e preserva acesso até o fim do período quando informado;
- reativação usa novo checkout quando não houver reativação direta disponível;
- reembolso/chargeback removem entitlement, mas não apagam conta, exercícios, projetos ou progresso.

## Banco e migration

Migration baseline: `prisma/migrations/20260826210000_auth_billing_baseline/migration.sql`.

Principais entidades/campos alterados:

- `User`: verificação de e-mail e aceite/versionamento legal;
- `Profile`: onboarding, locale, linguagem inicial e preferências de estudo;
- `UserSession`, `PasswordResetToken`, `EmailVerificationToken`;
- `Subscription`: provedor, IDs externos, plano, status, período e cancelamento ao final;
- `CheckoutContext`: vínculo opaco e idempotente entre conta e checkout;
- `Payment`: transações sem dados de cartão;
- `BillingWebhookEvent`: ID externo único, hash, recebimento/processamento e erro;
- `FeatureEntitlement` e serviço central de entitlements;
- `ProductEvent` para analytics sem senha, token ou dado financeiro sensível;
- `ProgressBackup` para persistência versionada por usuário.

## Segurança

- plano/role vêm da sessão e do banco, nunca do estado do navegador;
- tentativa de enviar `premium=true`, `approved=true`, preço ou role é ignorada/rejeitada;
- recursos Premium possuem gate server-side e endpoint de entitlement retorna 403 para Free;
- Admin é verificado no servidor e possui uma aba de assinaturas com usuário, plano, status, provedor, IDs externos e período, sem expor senha, cartão ou secrets;
- não existe endpoint de ajuste manual de assinatura; portanto não existe bypass administrativo sem motivo/auditoria;
- progresso e requisitos pedagógicos são independentes do plano: idiomas avançados exigem entitlement e requisitos de nível/domínio;
- proteção de origem, limites de corpo, rate limit, mensagens neutras e scan de segredos permanecem ativos;
- segredos de webhook/OAuth/e-mail são exclusivamente server-side.

## Analytics

Implementados: `pricing_viewed`, `checkout_started`, `checkout_redirected`, `payment_confirmed`, `subscription_activated`, `subscription_canceled`, `signup_started`, `signup_completed`, `login_success` e `onboarding_completed`.

`checkout_abandoned` não é inferido pelo frontend. Para produzi-lo com confiança será necessário um job de expiração/reconciliação dos `CheckoutContext` não convertidos.

## Testes

Cobertura adicionada/revisada:

- cadastro válido e inválido, senha inválida, login correto/incorreto, recuperação neutra, reset de uso único, logout e sessão persistente;
- rota autenticada, Admin e isolamento entre alunos;
- plano inválido, preço/status forjados, webhook falso, mapeamento de aprovação/pendência/cancelamento/reembolso/chargeback e entitlements Free/Premium;
- proteção contra role, XP, linguagem e Premium forjados;
- responsividade específica em 360, 390 e 430 px, além da matriz existente de viewport/zoom;
- onboarding, perfil, fluxo Free/paywall/planos e persistência após reload.

Comandos executados nesta entrega:

- `npm run lint`;
- `npm run typecheck`;
- `npm run test:security`;
- `npm run security:secrets`;
- `npm audit --audit-level=high`;
- `npx prisma validate` e `npx prisma generate`;
- `npm run build`;
- suíte Playwright completa em desktop/mobile.

Resultado final da matriz Playwright: **206 testes aprovados, 14 ignorados intencionalmente e 0 falhas** em 220 cenários coletados. Os skips evitam repetir no projeto mobile contratos executados explicitamente na matriz de viewports/zoom ou uma variação desktop-only equivalente.

Testes que exigem PostgreSQL real e eventos do sandbox Hotmart não podem ser executados sem infraestrutura/credenciais. A homologação deve confirmar aprovação, duplicidade, renovação, atraso, cancelamento, reembolso e chargeback com eventos reais do provedor antes de aceitar cobranças.

## Pendências externas obrigatórias

1. Provisionar PostgreSQL, configurar `DATABASE_URL` e aplicar `prisma migrate deploy`.
2. Configurar HTTPS em `NEXT_PUBLIC_APP_URL`.
3. Configurar Resend: `AUTH_EMAIL_DELIVERY=resend`, `AUTH_EMAIL_FROM`, `RESEND_API_KEY` e domínio remetente verificado.
4. Configurar Hotmart: `HOTMART_CHECKOUT_URL`, `HOTMART_WEBHOOK_SECRET`, `HOTMART_PRODUCT_ID` e, se aplicável, `HOTMART_OFFER_CODE`.
5. Para cancelamento pelo app, configurar `HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET` e `HOTMART_BASIC_TOKEN`.
6. Cadastrar na Hotmart as URLs HTTPS de sucesso/cancelamento e o webhook v2 para todos os eventos tratados.
7. Homologar primeiro no sandbox Hotmart e só então desativar `HOTMART_SANDBOX`.
8. Adicionar Redis ou equivalente para rate limit distribuído em múltiplas instâncias.
9. Criar job de reconciliação/expiração para checkout abandonado e divergências ocasionais de webhook.
10. Validar backup/restauração, monitoramento e alertas antes de produção.

Bloqueios gerais já existentes e fora do escopo estrito de login/checkout continuam válidos: soluções/testes privados ainda precisam sair do bundle do cliente e a correção autoritativa de código/XP exige executor externo isolado.
