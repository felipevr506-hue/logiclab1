# Auditoria e hardening de seguranÃ§a â€” 21/08/2026

## Resumo executivo

O repositÃ³rio foi auditado antes das alteraÃ§Ãµes. O hardening fechou a escalada
remota de Admin no demo, impediu o modo demo em produÃ§Ã£o, trocou o isolamento de
progresso para ID interno, neutralizou campos autoritativos enviados pelo
navegador, adicionou reautenticaÃ§Ã£o e removeu a dependÃªncia vulnerÃ¡vel.

O produto **continua nÃ£o aprovado para produÃ§Ã£o**. Dois problemas estruturais
permanecem crÃ­ticos: soluÃ§Ãµes/testes estÃ£o no bundle e nÃ£o hÃ¡ executor externo
capaz de validar tentativas com isolamento forte. CobranÃ§a e runner estrito
ficaram bloqueados para que a interface nÃ£o prometa uma proteÃ§Ã£o inexistente.

## Vulnerabilidades e correÃ§Ãµes

| ID | Severidade | Achado | SituaÃ§Ã£o apÃ³s hardening |
| --- | --- | --- | --- |
| SEC-01 | CRÃTICO | `AUTH_MODE=demo` concedia Admin e liberava `/admin` e APIs administrativas sem sessÃ£o | Corrigido. Demo comum Ã© `STUDENT`; Admin de E2E exige simultaneamente dev + test + flag, e sessÃ£o real sempre tem precedÃªncia |
| SEC-02 | CRÃTICO | O cliente podia enviar papel, plano, XP, nÃ­vel, conclusÃµes, habilidades, recompensas e linguagens no backup | Mitigado no servidor. Esses campos sÃ£o ignorados/neutralizados e plano/papel vÃªm da conta; XP confiÃ¡vel permanece bloqueado atÃ© existir correÃ§Ã£o server-side |
| SEC-03 | CRÃTICO | SoluÃ§Ãµes, expressÃµes e resultados esperados aparecem nos chunks do cliente | **Pendente/bloqueador**. Confirmado novamente no build; requer separar conteÃºdo privado e validar em executor server-side |
| SEC-04 | ALTO | `AUTH_MODE=demo` podia ser ativado em um processo de produÃ§Ã£o | Corrigido. `APP_ENV=production|staging` sempre retorna modo obrigatÃ³rio |
| SEC-05 | ALTO | Progresso era endereÃ§ado por e-mail; troca e reaproveitamento do e-mail poderiam expor backup legado | Corrigido para contas autenticadas: arquivo Ã© endereÃ§ado por `user:<id>` e nÃ£o hÃ¡ migraÃ§Ã£o automÃ¡tica insegura por e-mail |
| SEC-06 | ALTO | Troca de e-mail nÃ£o exigia senha e alegava verificaÃ§Ã£o sem criar token | Corrigido. Exige senha, invalida status, emite token hash/expirÃ¡vel/uso Ãºnico; entrega externa ainda pendente |
| SEC-07 | ALTO | ExportaÃ§Ã£o de dados nÃ£o exigia reautenticaÃ§Ã£o | Corrigido. ExportaÃ§Ã£o agora Ã© POST same-origin com confirmaÃ§Ã£o da senha |
| SEC-08 | ALTO | CSP permitia `unsafe-eval` em produÃ§Ã£o | Corrigido no build estrito. `unsafe-eval` fica apenas em dev/test; `unsafe-inline` permanece como risco mÃ©dio documentado |
| SEC-09 | ALTO | Runner local compila cÃ³digo com `Function`; nÃ£o Ã© isolamento forte nem correÃ§Ã£o confiÃ¡vel | **Mitigado/bloqueador**. Desativado no ambiente estrito e sem autoridade; sandbox externo continua obrigatÃ³rio |
| SEC-10 | ALTO | `deepmerge-ts@7.1.5`, transitivo do Prisma, estava afetado por exaustÃ£o de pilha (GHSA-ggr8-5vv4-36mx) | Corrigido com override para 8.x; `npm audit` completo retorna zero vulnerabilidades conhecidas |
| SEC-11 | ALTO | Link fixo de checkout nÃ£o vinculava comprador/conta e nÃ£o havia webhook | Corrigido por bloqueio seguro. Nenhuma cobranÃ§a abre atÃ© adapter + webhook assinado/idempotente existirem |
| SEC-12 | MÃ‰DIO | Cookie Secure dependia apenas de uma URL pÃºblica possivelmente mal configurada | Corrigido. ProduÃ§Ã£o/staging forÃ§am Secure e nome `__Host-logiclab_session` |
| SEC-13 | MÃ‰DIO | IP de rate limit confiava sempre em `x-forwarded-for`, permitindo spoof fora de proxy confiÃ¡vel | Corrigido. Headers de proxy sÃ³ sÃ£o usados com `TRUST_PROXY_HEADERS=true`; store distribuÃ­do continua pendente |
| SEC-14 | MÃ‰DIO | OperaÃ§Ãµes crÃ­ticas e falhas de login nÃ£o possuÃ­am trilha dedicada | Corrigido em arquivo local com identificador de e-mail truncado por hash; banco/retencÃ£o/alertas permanecem pendentes |
| SEC-15 | MÃ‰DIO | Avatar validava apenas tamanho/`accept` do input | Corrigido para MIME permitida e assinatura PNG/JPEG/WebP; armazenamento externo nÃ£o existe |
| SEC-16 | MÃ‰DIO | Filas de escrita ficavam permanentemente rejeitadas apÃ³s uma falha | Corrigido com recuperaÃ§Ã£o da fila e permissÃ£o `0600` onde suportada |
| SEC-17 | MÃ‰DIO | `unsafe-inline`, stores em arquivo, rate limit em memÃ³ria, ausÃªncia de MFA e de monitoramento externo | Pendente e listado no gate de produÃ§Ã£o |

Nenhuma afirmaÃ§Ã£o de seguranÃ§a absoluta Ã© feita. Um `npm audit` sem achados
nÃ£o cobre falhas de lÃ³gica, supply chain futura ou configuraÃ§Ã£o externa.

## APIs protegidas ou endurecidas

| SuperfÃ­cie | Controle |
| --- | --- |
| `/api/admin/audit`, `/api/admin/security`, `/api/admin/usage` | papel Admin verificado no servidor; demo comum recebe 403 |
| `/api/features` | Admin + mutaÃ§Ã£o same-origin + rate limit + auditoria |
| `/api/progress` | sessÃ£o/conta, chave por ID interno, validaÃ§Ã£o de forma/tamanho/protÃ³tipo e remoÃ§Ã£o de autoridade do cliente |
| `/api/auth/account` | sessÃ£o, same-origin, reautenticaÃ§Ã£o para exportar/e-mail/excluir e sessÃµes revogadas na troca de senha |
| `/api/auth/verify-email` | token hash, expiraÃ§Ã£o, uso Ãºnico e rate limit |
| `/api/billing/checkout` | sessÃ£o e e-mail verificado; serviÃ§o bloqueia checkout sem adapter seguro |
| login/cadastro/recuperaÃ§Ã£o | resposta neutra onde aplicÃ¡vel, scrypt, rate limit, tokens hash e eventos sem credenciais |
| uploads locais | tamanho, MIME e assinatura raster |

## RLS e banco

Policies RLS criadas/alteradas: **nenhuma**. Supabase/PostgreSQL nÃ£o estÃ£o
conectados ao runtime; inventar policies sem o adapter e sem testes de banco
daria uma falsa garantia. Se Supabase for adotado, a entrega sÃ³ pode avanÃ§ar
apÃ³s policies deny-by-default e testes reais com aluno A, aluno B e Admin.

## Segredos

- scan atual: nenhum candidato nos arquivos versionÃ¡veis;
- `.env`, `.data`, caches, resultados e logs estÃ£o ignorados;
- `AUTH_SECRET` removido do exemplo por nÃ£o ser usado pelo store de tokens
  opacos;
- o diretÃ³rio recebido nÃ£o contÃ©m `.git`; histÃ³rico e branches remotos nÃ£o
  puderam ser auditados;
- secrets a rotacionar agora: nenhum identificado;
- pendÃªncia: executar scan no repositÃ³rio Git canÃ´nico e rotacionar qualquer
  credencial real encontrada, sem reaproveitÃ¡-la.

## Testes adicionados

- produÃ§Ã£o ignora tentativa de habilitar demo;
- origem cross-site Ã© rejeitada;
- payload forjado nÃ£o concede Admin/Pro/XP/nÃ­vel/skills/linguagens;
- chaves de prototype pollution sÃ£o recusadas;
- aluno B nÃ£o lÃª progresso de A;
- aluno comum recebe 403 em Admin e feature flags;
- ciclo de conta cobre exportaÃ§Ã£o reautenticada, recuperaÃ§Ã£o de uso Ãºnico,
  invalidaÃ§Ã£o de sessÃ£o e exclusÃ£o;
- smoke de produÃ§Ã£o confirmou Admin/progresso demo = 403, CSP sem
  `unsafe-eval` e HSTS presente.

## Resultado da validação

- TypeScript, ESLint, build de 47 páginas, scan de segredos e `npm audit`: aprovados;
- políticas de segurança: 4/4 aprovadas;
- isolamento entre contas, autorização Admin e ciclo completo de conta: 3/3 E2E aprovados;
- regressões mobile de caderno, perfil/avatar, exercício e Tutor: 4/4 aprovadas;
- a matriz completa iniciou 216 casos, mas atingiu o timeout no caso 195. Os
  quatro erros observados na execução complementar foram corrigidos e repetidos
  isoladamente. A matriz inteira ainda deve ser repetida antes do lançamento e
  não é apresentada como totalmente aprovada.

Cada execução E2E agora usa um namespace aleatório restrito a `.tmp`, removido
ao final, para impedir dependência entre testes por estado server-side antigo.

## Arquivos modificados

- autenticaÃ§Ã£o e sessÃ£o: `services/auth/*`, `app/api/auth/*`;
- autoridade e isolamento: `services/sync/*`, `app/api/progress/route.ts`;
- ambiente, CSRF, rate limit e eventos: `services/security/*`;
- Admin e treino: rotas de Admin, feature flags e preview;
- executor/pagamentos/status: `services/code-runner/*`, `services/payments/*`,
  `app/api/billing/*`, `app/api/status/*`;
- cliente: identidade hidratada pelo servidor, reautenticaÃ§Ã£o e avatar;
- supply chain/CI: `package*.json`, scripts de scan/teste e workflow;
- documentaÃ§Ã£o: `SECURITY.md`, este relatÃ³rio, README e operaÃ§Ã£o.

## ConfiguraÃ§Ãµes e serviÃ§os externos pendentes

1. Node.js 22 LTS no build/runtime;
2. PostgreSQL transacional realmente conectado e migrations ensaiadas;
3. Redis/KV para rate limit distribuÃ­do;
4. executor efÃªmero com rede negada e quotas duras;
5. conteÃºdo/testes privados fora do bundle;
6. Hotmart/Kiwify/outro adapter com webhook assinado e idempotente;
7. e-mail transacional, verificaÃ§Ã£o de domÃ­nio e templates;
8. cofre de secrets, rotaÃ§Ã£o, alertas, backup restaurado e runbook testado;
9. CSP com nonce/hash e remoÃ§Ã£o de `unsafe-inline`;
10. MFA/reauth recente para Admin e revisÃ£o independente antes do lanÃ§amento.

## ReferÃªncias tÃ©cnicas usadas

- [CSP no App Router do Next.js](https://nextjs.org/docs/app/guides/content-security-policy)
- [allowedDevOrigins do Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins)
- [Node.js: `vm` nÃ£o Ã© mecanismo de seguranÃ§a](https://nodejs.org/api/vm.html)
- [Advisory GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
- [npm audit](https://docs.npmjs.com/cli/audit/)
