# Fase 1: identidade e isolamento de contas

O fluxo normal exige autenticação, inclusive em desenvolvimento. O modo
demonstrativo continua disponível somente com `AUTH_MODE=demo` em ambiente
de desenvolvimento/teste; staging e produção sempre exigem sessão.

## Armazenamento

- A identidade vem de `/api/auth/me`, nunca do armazenamento do navegador.
- `localStorage`: `logiclab-state-v2:<ID da conta codificado>`.
- IndexedDB: `logiclab-training-v2:<ID da conta codificado>`.
- A preferência de idioma faz parte do estado da conta; o armazenamento global
  antigo não é usado para definir preferências de outras contas.
- Login, logout e exclusão de conta fazem navegação completa para descartar
  componentes e permissões renderizadas da sessão anterior.
- Outras abas recebem um evento de troca de autenticação e recarregam. O foco
  da janela também verifica novamente a sessão.
- Logout mantém o cache individual para permitir o retorno à mesma conta.
- O encerramento de sessão é separado do reinício de demonstração. O perfil
  só oferece reinício de demo quando esse modo foi explicitamente habilitado.
- A sincronização valida o ID do dono tanto na API quanto na resposta antes
  de mesclar dados. Respostas após desmontar o estado antigo são ignoradas.

Os armazenamentos compartilhados `logiclab-state-v1`, `logiclab-training-v1`
e `logiclab-locale` são preservados, mas não importados automaticamente. Não
há informação suficiente para atribuir todo o conteúdo antigo a um usuário.
Backups remotos existentes continuam associados à conta autenticada no servidor.
Esta fase não corrige retroativamente conteúdo já misturado em backups antigos.

## Verificação

```powershell
npm run typecheck
npm run test:security
node node_modules/@playwright/test/cli.js test --config playwright.phase1.config.ts
$env:PHASE1_AUTH_MODE = "demo"
node node_modules/@playwright/test/cli.js test --config playwright.phase1.config.ts --grep "explicit demo configuration"
Remove-Item Env:\PHASE1_AUTH_MODE
```

O teste E2E usa porta 3207, `DATABASE_URL` vazio no processo filho e um namespace
temporário exclusivo em `.tmp`. Não usa nem modifica o PostgreSQL restaurado.
A suíte antiga de demonstração continua dependendo de configuração explícita
de demo, como a já fornecida por `scripts/run-e2e.ps1`.

Não havia repositório Git na pasta ou nos ancestrais durante a implementação.
Os arquivos anteriores às edições foram copiados para `.tmp/phase1-before`.

## Arquivos envolvidos

Código:

- `app/api/auth/me/route.ts`
- `app/api/progress/route.ts`
- `components/auth-screen.tsx`
- `components/app-shell.tsx` (encerramento de sessão, sem redesenho do menu)
- `components/account-security-page.tsx` (limpeza da sessão após excluir conta)
- `components/platform-pages.tsx` (controle de reinício restrito à demo)
- `lib/account-storage.ts` (novo)
- `lib/app-state.tsx`
- `lib/types.ts`
- `lib/use-app-locale.ts`
- `services/auth/auth-store.ts`
- `services/persistence/training-database.ts`
- `services/sync/progress-sync.ts`

Validação e documentação:

- `scripts/run-security-tests.ps1`
- `tests/security/policies.test.ts`
- `tests/security/account-storage.test.ts` (novo)
- `tests/e2e/account-isolation.spec.ts` (novo)
- `tests/e2e/site.spec.ts` (namespace de demo e identidade esperada)
- `tests/e2e/new-features.spec.ts` (namespace de demo)
- `playwright.phase1.config.ts` (novo)
- `docs/PHASE1_ACCOUNT_ISOLATION.md` (novo)

## Limite de escopo

Não há alterações de landing page, dashboard, Tutor, schema ou migrations.
O servidor continua neutralizando XP e conclusões enviados pelo navegador;
o registro confiável dessas premiações no servidor pertence à Fase 3.

## Resultados e ocorrências

- `npm run typecheck`: aprovado após encerrar o servidor de testes.
- `npm run test:security`: 15 testes aprovados.
- ESLint dos arquivos TypeScript alterados: aprovado, sem erros ou avisos.
- Suíte E2E principal: 5 testes aprovados; o cenário de demo é separado dessa
  execução e fica intencionalmente ignorado quando a configuração não é demo.
- Suíte E2E com demo explícito: 1 teste aprovado, incluindo reinício exclusivo
  da demonstração sem encerrar indevidamente a sessão.
- A execução usa contas temporárias e não modifica o banco `loglab`.
- Foram observados lentidão de compilação e cache de testes inconsistente após
  interrupções. O cache anterior foi preservado em `.tmp/phase1-cache-before-*`
  e regenerado. Os limites de tempo dos testes consideram a compilação inicial.
- Uma execução intermediária apresentou `EPERM` ao renomear o arquivo temporário
  `security/accounts.json` do backend de testes em arquivo. A execução final
  passou; não foi alterado o mecanismo de gravação nem o PostgreSQL para
  contornar esse erro.
- O navegador registrou `Failed to parse URL from
  /monaco/vs/language/typescript/tsWorker.js`. Os cenários de edição e execução
  passaram, mas o problema do worker de linguagem do Monaco permanece fora do
  escopo desta fase.
- Os textos demonstrativos existentes no dashboard não foram redesenhados.
