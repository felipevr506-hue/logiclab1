# Fase 2: ciclo da conta

Escopo: cadastro, autenticação, confirmação de e-mail e recuperação de senha. A separação de localStorage/IndexedDB e a validação do proprietário do progresso da Fase 1 foram preservadas. Landing, dashboard, Tutor e gamificação não fazem parte desta fase.

## Backup e migração

O diretório não possui repositório Git configurado. O estado anterior foi copiado para `.tmp/phase2-before`; o backup lógico PostgreSQL está em `.tmp/phase2-before/loglab-before.dump`. Esses arquivos podem conter dados pessoais e devem permanecer locais e protegidos.

Migration: `prisma/migrations/20261017180000_username_and_normalized_email/migration.sql`.

- Adiciona username obrigatório, único e minúsculo, com formato de 3 a 32 caracteres.
- Preserva IDs e relações; usuários anteriores recebem `legacy_1`, `legacy_2`, etc., segundo a ordenação de IDs. O prefixo é reservado no cadastro para evitar apropriação desses nomes.
- Normaliza e-mails existentes e impede valores futuros não normalizados. Aborta antes das alterações se houver colisões equivalentes de e-mail.
- Usa uma transação e lock com timeout; não apaga nem recria `loglab`, usuários, sessões ou progresso.
- Não confirma automaticamente e-mails antigos. Contas anteriores não verificadas precisam confirmar o endereço.

## Comportamento

Antes: cadastro sem username/confirmar senha e acesso possível antes da confirmação; envio assíncrono não informava falha ao usuário.

Agora: nome, username, e-mail, senha, confirmação e aceite dos termos são obrigatórios. Login continua por e-mail/senha. Uma sessão não verificada permite apenas concluir a configuração e administrar a própria autenticação; páginas de estudo e APIs protegidas exigem confirmação. Não há identidade demo automática.

O cadastro cria a conta mesmo quando o envio falha, informa a falha e permite reenvio. Reenvio exige sessão, intervalo mínimo de 60 segundos e no máximo cinco tokens por hora por conta, persistidos no PostgreSQL; também há limite por IP. O envio após troca de e-mail respeita o mesmo limite para impedir esse caminho alternativo de abuso; se limitado, o endereço é atualizado, a confirmação continua pendente e a resposta informa falha de entrega e prazo de espera. Tokens antigos são invalidados no reenvio e na troca de e-mail. A confirmação distingue token inválido, expirado, utilizado e conta já verificada. GET não consome tokens; o usuário confirma por POST para evitar consumo por scanners de e-mail.

A recuperação usa resposta anônima idêntica para e-mails conhecidos/desconhecidos e falhas do provedor, evitando enumeração; o texto não promete envio. Falhas são registradas sem token nem credenciais. Reset exige confirmação da senha, invalida sessões anteriores da conta e não encerra a sessão válida de outra conta no mesmo navegador. Logout continua encerrando somente a sessão atual.

## E-mail e configuração externa

Produção requer `APP_ENV=production`, `AUTH_MODE=required`, `AUTH_EMAIL_DELIVERY=resend`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM` em domínio verificado e `NEXT_PUBLIC_APP_URL` HTTPS. Configure o domínio/remetente no Resend e seus registros DNS. Receber um ID do provedor significa aceite do envio, não garantia de chegada à caixa de entrada. Ausência de configuração, falha HTTP, timeout ou falta de recibo resultam em falha, nunca em confirmação automática.

Somente em desenvolvimento/teste, com NODE_ENV diferente de production, `AUTH_EMAIL_DELIVERY=console`/`development` oferece link local claramente marcado; sem modo e sem chave também permite esse fallback. O link só aparece em respostas a localhost/loopback. Não imprime tokens no console, não os persiste em armazenamento compartilhado e nunca oferece links locais em produção/staging. Use `APP_ENV=development` para desenvolvimento normal; não alteramos `.env.local`.

Os limites por conta no PostgreSQL funcionam entre instâncias; os limites por IP existentes continuam em memória por processo. Uma implantação com várias réplicas deve usar armazenamento compartilhado para esses limites por IP. Habilite confiança em cabeçalhos de proxy somente atrás de proxy controlado.

## Arquivos envolvidos

- Banco: `prisma/schema.prisma` e a migration acima.
- Persistência/autorização: `services/auth/auth-store.ts`, `services/auth/database-auth-store.ts`, `services/auth/verification-policy.ts`.
- Validação/transição de sessão: `lib/auth-validation.ts`, `lib/auth-delivery.ts`, `lib/account-storage.ts`.
- E-mail: `services/email/auth-email.ts`.
- APIs em `app/api/auth`: signup, login, me, account, sessions, verify-email, resend-verification, forgot-password e reset-password.
- Páginas: `app/confirmar-email/page.tsx`, `app/verificar-email/page.tsx`; proteção em `app/(platform)/layout.tsx` e `app/onboarding/page.tsx`.
- Componentes: `components/auth-screen.tsx`, `components/auth-flows.tsx`, `components/email-verification.tsx`, `components/account-security-page.tsx`.
- Testes novos: `tests/security/auth-lifecycle.test.ts`, `tests/e2e/auth-lifecycle.spec.ts` e `tests/e2e/auth-helpers.ts`.
- Runner e isolamento dos testes: `scripts/run-security-tests.ps1`, `playwright.phase2.config.ts`, `scripts/phase2-test-server.cjs`, `tests/phase2-teardown.ts`.
- Fixtures atualizadas para os novos campos e confirmação: `tests/e2e/account-isolation.spec.ts`, `tests/e2e/security-isolation.spec.ts`, `tests/e2e/security.spec.ts`, `tests/e2e/site.spec.ts`, `tests/e2e/new-features.spec.ts`, `tests/e2e/auth-billing.spec.ts`.

## Verificação

Os testes de integração criam um banco exclusivo `logiclab_phase2_test_<identificador>`, aplicam as migrations sobre uma conta legada com progresso e verificam preservação. A limpeza exige nome validado e marcador de propriedade; nunca opera sobre `loglab`. Nenhum e-mail real é enviado pelos testes. O cenário de falha de entrega roda separadamente com `PHASE2_EMAIL_FAILURE=1`.

Resultados finais (17/10/2026):

- `npm run typecheck`: aprovado, saída 0.
- `npm run lint`: aprovado, saída 0, sem erros nem avisos.
- `npm run test:security`: 20 testes aprovados, nenhum erro ou teste ignorado. Os avisos de falha de entrega são esperados nos testes que simulam o provedor.
- `playwright test --config playwright.phase2.config.ts`: 12 cenários aprovados na rodada principal; demo explícito e provedor indisponível são condicionais e foram executados separadamente.
- `playwright test --config playwright.phase2.config.ts --grep email-change`: um cenário adicional aprovado, cobrindo a troca de endereço sem contornar o limite de confirmação.
- Com `PHASE2_EMAIL_FAILURE=1`, `playwright test --config playwright.phase2.config.ts --grep provider`: um cenário aprovado, incluindo tela real de cadastro, aviso de falha, bloqueio de acesso e reenvio HTTP 503.
- Com `PHASE1_AUTH_MODE=demo`, `playwright test --config playwright.phase1.config.ts --grep explicit`: um cenário aprovado; demo exige configuração explícita.
- Total: 15 cenários de integração/E2E aprovados, além dos 20 testes de segurança.
- Conferência final somente leitura: `loglab`, dois usuários, dois usernames distintos, nenhum e-mail confirmado automaticamente e ambas as migrations aplicadas. Todos os bancos temporários criados pelas execuções foram removidos pelo teardown.
- Comparação com o backup: sem alterações em landing, dashboard, shell, exercício, Tutor, gamificação ou sincronização da Fase 1. A única mudança no helper de armazenamento é a limpeza dos avisos temporários de entrega ao trocar de sessão.

Os cenários cobrem cadastro válido; duplicatas de username, suas variantes de caixa e e-mail; confirmação diferente e aceite obrigatório; login correto/incorreto; bloqueio de contas não verificadas; confirmação válida/inválida/expirada/utilizada/já verificada; reenvio e limites; recuperação/reset; revogação de sessões anteriores sem apagar a sessão de outra conta; isolamento de localStorage/IndexedDB e progresso entre A/B; retorno a A; conta nova limpa; logout entre abas e recusa de backups de outro usuário.

Logs locais: `.tmp/phase2-{typecheck-final,eslint-final,security-final,e2e-final,email-change,provider-failure-final,demo}.log`. A rodada exploratória inicial apontou ajustes no rótulo acessível de username e nas fixtures de UTC/seletores; as execuções finais acima passaram. Nenhuma falha foi ocultada por retries.

## Pendências de produto/operação

Não foi implementada edição de usernames legados: eles são exclusivos e válidos, mas provisórios. Configuração e entrega real do Resend devem ser verificadas no ambiente de publicação. Reinicie o servidor de desenvolvimento após a geração do Prisma Client para descartar uma possível instância antiga em memória; o servidor de desenvolvimento que já estava aberto foi preservado. O problema preexistente do worker Monaco (`Failed to parse URL from /monaco/vs/language/typescript/tsWorker.js`) continuou aparecendo no console durante os testes de exercício, mas não impediu os cenários de isolamento. Também houve avisos de filesystem lento e requisições de desenvolvimento abortadas durante navegação. Esses problemas não foram alterados nesta fase.
