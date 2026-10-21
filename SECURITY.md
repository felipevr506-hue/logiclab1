# SeguranÃ§a do LogicLab

O LogicLab ainda nÃ£o estÃ¡ pronto para produÃ§Ã£o. O endpoint `/api/status`
retorna `productionReady: false` e enumera os bloqueios ativos. NÃ£o exponha o
MVP atual Ã  internet nem aceite pagamentos atÃ© concluir esses itens.

## Como reportar

Relate vulnerabilidades de forma privada para `contato@logiclab.dev`. Inclua a
rota, o impacto e passos mÃ­nimos de reproduÃ§Ã£o, sem dados pessoais reais e sem
explorar contas de terceiros. NÃ£o abra uma issue pÃºblica antes da triagem.

## Limites de confianÃ§a

O navegador, localStorage, IndexedDB, parÃ¢metros, uploads, cÃ³digo do aluno e
requests do cliente sÃ£o tratados como nÃ£o confiÃ¡veis. Em modo autenticado:

- sessÃ£o, papel e plano vÃªm do servidor;
- progresso Ã© armazenado por ID interno, nunca por e-mail reutilizÃ¡vel;
- o backup genÃ©rico nÃ£o pode conceder XP, nÃ­vel, conclusÃ£o, habilidade,
  recompensa, token de ajuda, linguagem, Premium, Admin ou feature flag;
- APIs administrativas verificam a sessÃ£o e o papel no servidor;
- produÃ§Ã£o ignora `AUTH_MODE=demo` e usa cookie `__Host-` Secure/HttpOnly.

## Controles implementados

- senhas derivadas com scrypt e salt individual;
- tokens de sessÃ£o, recuperaÃ§Ã£o e verificaÃ§Ã£o de e-mail aleatÃ³rios, mantidos
  apenas como hash, com expiraÃ§Ã£o e uso Ãºnico;
- resposta neutra na recuperaÃ§Ã£o e invalidaÃ§Ã£o das sessÃµes apÃ³s redefiniÃ§Ã£o;
- reautenticaÃ§Ã£o para e-mail, exportaÃ§Ã£o e exclusÃ£o; troca de senha encerra as
  outras sessÃµes;
- validaÃ§Ã£o de origem, cabeÃ§alho de mutaÃ§Ã£o same-origin, SameSite e limites de
  requisiÃ§Ã£o;
- Admin negado ao usuÃ¡rio demo comum; a exceÃ§Ã£o do E2E sÃ³ existe quando
  `NODE_ENV=development`, `APP_ENV=test` e `TEST_AUTH_ROLE=ADMIN` coexistem;
- CSP sem `unsafe-eval` em build estrito, HSTS, anti-framing, `nosniff`, COOP,
  CORP, Referrer-Policy e Permissions-Policy;
- trilha de eventos de login e operaÃ§Ãµes crÃ­ticas sem e-mail, senha ou token em
  claro;
- validaÃ§Ã£o de tipo, tamanho e assinatura mÃ­nima para avatar raster;
- scan de segredos, auditoria de dependÃªncias e testes de polÃ­ticas no CI.

## Executor

O Web Worker com `Function` existe somente como ferramenta local de
desenvolvimento e nÃ£o Ã© uma fronteira forte nem autoridade para correÃ§Ã£o ou
XP. Em ambiente estrito, `unsafe-eval` Ã© removido e o runner fica bloqueado.
ProduÃ§Ã£o exige um executor externo efÃªmero, sem rede, sem secrets, com limites
de CPU, memÃ³ria, processos, arquivos, saÃ­da e tempo. `node:vm` nÃ£o deve ser
usado como sandbox; a prÃ³pria documentaÃ§Ã£o do Node diz que ele nÃ£o Ã© um
mecanismo de seguranÃ§a.

## Pagamentos

O adapter Hotmart cria no servidor um `CheckoutContext` idempotente e vincula o
checkout Ã  conta por um identificador opaco. O plano sÃ³ muda depois de webhook
v2 com `X-HOTMART-HOTTOK`, produto/oferta autorizados e evento Ãºnico. Retorno
visual, query string, preÃ§o e estado do frontend nunca concedem Premium. Sem
PostgreSQL e credenciais Hotmart, o checkout permanece indisponÃ­vel e nÃ£o Ã©
simulado.

## Banco e RLS

O runtime de produÃ§Ã£o usa Prisma/PostgreSQL para contas, sessÃµes, tokens,
perfis, assinaturas, pagamentos, webhooks, analytics e backup de progresso. O
fallback em arquivo Ã© restrito a desenvolvimento/testes. O projeto nÃ£o usa
Supabase, portanto nenhuma policy RLS Ã© alegada; o isolamento ocorre nos
serviÃ§os por ID da sessÃ£o. Se Supabase for adotado futuramente, habilite RLS em
todas as tabelas privadas e nunca envie `service_role` ao cliente.

## Segredos

Somente variÃ¡veis `NEXT_PUBLIC_*` podem ir ao bundle, e elas nÃ£o podem conter
credenciais. `.env`, `.data`, logs, resultados e caches estÃ£o ignorados. O scan
atual nÃ£o encontrou candidatos nos arquivos versionÃ¡veis; o diretÃ³rio entregue
nÃ£o continha `.git`, entÃ£o o histÃ³rico nÃ£o pÃ´de ser auditado. Execute a anÃ¡lise
tambÃ©m no repositÃ³rio Git canÃ´nico e rotacione imediatamente qualquer chave
real encontrada.

## Bloqueios de produÃ§Ã£o

1. soluÃ§Ãµes e testes de exercÃ­cio ainda aparecem no bundle do cliente;
2. nÃ£o existe executor externo confiÃ¡vel para validar tentativas;
3. XP e domÃ­nio reais ainda nÃ£o sÃ£o concedidos por eventos verificados no
   servidor;
4. rate limit e parte da auditoria operacional ainda usam memÃ³ria/arquivo e
   precisam de Redis/storage compartilhado em mÃºltiplas instÃ¢ncias;
5. credenciais, URLs e homologaÃ§Ã£o real de PostgreSQL, Resend e Hotmart ainda
   dependem do ambiente externo;
6. backup restaurado, reconciliaÃ§Ã£o periÃ³dica de billing e monitoramento
   externo ainda precisam ser exercitados em infraestrutura real;
7. CSP ainda usa `unsafe-inline`; a migraÃ§Ã£o para nonce/hash precisa ser
   ensaiada com Monaco e renderizaÃ§Ã£o dinÃ¢mica.

## Incidentes

Em incidente: preserve evidÃªncias, revogue chaves/sessÃµes afetadas, bloqueie o
vetor, restaure de backup testado, registre linha do tempo/impacto e comunique
usuÃ¡rios quando aplicÃ¡vel. Logs nÃ£o devem conter senhas, tokens, cÃ³digo do aluno
ou payload financeiro completo.

O relatÃ³rio da auditoria, severidades, arquivos e pendÃªncias estÃ¡ em
`docs/SECURITY_AUDIT_2026-08-21.md`.
