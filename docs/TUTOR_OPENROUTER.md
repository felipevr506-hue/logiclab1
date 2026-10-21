# Tutor: OpenAI ou OpenRouter

O Tutor mantém a mesma API autenticada, montagem de contexto no servidor, histórico por usuário/exercício, filtros pedagógicos, cotas PostgreSQL, idempotência, timeout de 25 segundos e cancelamento da Fase 7. Apenas o adaptador HTTP muda. Não houve alteração visual, migration, dependência nova ou mudança de autenticação, progresso, XP ou executor.

## Alternar o provider

No `.env.local` do servidor, para desenvolvimento com OpenRouter:

```ini
TUTOR_PROVIDER=openrouter
OPENROUTER_API_KEY=SUA_CHAVE_PRIVADA
TUTOR_MODEL=openrouter/free
```

Para voltar à OpenAI:

```ini
TUTOR_PROVIDER=openai
OPENAI_API_KEY=SUA_CHAVE_PRIVADA
TUTOR_MODEL=MODELO_DA_SUA_CONTA
```

Os valores acima são instruções, não credenciais configuradas pelo agente. Reinicie o servidor Next depois de mudar o ambiente. As duas chaves podem coexistir; somente a chave do provider escolhido é utilizada. Não use prefixo `NEXT_PUBLIC_`. Provider desconhecido, modelo vazio ou chave correspondente ausente deixam o Tutor indisponível. Não há fallback automático entre providers nem para modelo pago. `TUTOR_GLOBAL_DAILY_LIMIT` continua opcional e compartilhado entre providers; trocar provider não renova a cota do usuário.

## Modelo gratuito e compatibilidade

`openrouter/free` é o ponto inicial indicado para este teste: o [Free Models Router oficial](https://openrouter.ai/docs/guides/routing/routers/free-router) escolhe modelos gratuitos que atendem aos parâmetros solicitados. A escolha do modelo e a disponibilidade podem variar. Um identificador específico `:free` também pode ser configurado, desde que esteja disponível e aceite saída estruturada.

O adaptador usa `https://openrouter.ai/api/v1/chat/completions`, mensagens system/user produzidas no servidor, `stream:false`, `max_tokens:450`, `response_format:json_schema` estrito e `provider.require_parameters:true`. Exige uma resposta concluída (`finish_reason:stop`) e JSON com `reply` textual. Não relaxa o schema nem exibe texto bruto quando o modelo não cumpre o contrato. A política pedagógica comum ainda valida a resposta antes de persistir/exibir. Referência: [saída estruturada](https://openrouter.ai/docs/guides/features/structured-outputs).

Modelos gratuitos têm disponibilidade, latência e [limites próprios do OpenRouter](https://openrouter.ai/docs/api/reference/limits), além das cotas do LogicLab. Não há garantia de disponibilidade de um modelo compatível a cada pedido. O teto de 450 tokens pode resultar em resposta incompleta, especialmente em modelos com raciocínio; nesse caso o pedido falha de forma segura. Regras de retenção e processamento passam a envolver OpenRouter e o provedor escolhido por ele; o `store:false` do adaptador OpenAI não constitui garantia de retenção no OpenRouter.

## Falhas e segurança

Sem chave/modelo, o painel informa que não está configurado. Erros HTTP (inclusive 402/429 por saldo/quota), indisponibilidade, resposta inválida/incompleta e timeout usam o tratamento de indisponibilidade existente: preservam texto e código, permitem tentativa explícita e não quebram o exercício. O corpo de erro do serviço não é enviado ao navegador nem registrado em logs pela integração. Uma reserva falha continua contando na cota, conforme a Fase 7. Não há repetição paga automática.

A chave só é lida no módulo `server-only` e usada no header Authorization. Não entra no contexto do modelo, histórico, configuração pública ou corpo de requisição. Os testes verificam separação de chaves, ausência de identificadores/endpoint privados nos scripts do navegador e recusa de saídas com solução. Permanecem as limitações pedagógicas documentadas na Fase 7: filtros heurísticos não provam a ausência de toda solução semanticamente equivalente e podem bloquear explicações válidas.

## Arquivos

- `services/ai/chat-provider.ts`: seleção por ambiente e adaptador OpenRouter implementando `ChatProvider`; OpenAI preservada.
- `.env.example`: nova chave vazia e exemplo de seleção, sem alterar `.env.local`.
- `tests/security/tutor-chat.test.ts`: seleção, chave ausente, contrato OpenRouter, erros e filtro compartilhado.
- `tests/e2e/tutor-chat.spec.ts`: checagem de ausência da chave/endpoint OpenRouter no código do navegador.
- `playwright.phase7.config.ts`: teste sem chave específico para cada provider.
- `docs/TUTOR_OPENROUTER.md`: este relatório.

Backup lógico dos principais arquivos anteriores em `.tmp/openrouter-before`; Git indisponível na máquina. Nenhuma credencial real foi criada ou modificada. Nenhuma chamada externa real foi feita pelos testes: o transporte do adaptador usa mocks e os E2E usam o provider fictício restrito a banco descartável. Os pedidos de documentação oficial foram apenas consultas públicas.

## Validação

**Rodada final: typecheck aprovado, ESLint sem erros, 44 testes unitários/segurança e 49 testes E2E aprovados.** O ESLint mantém somente o aviso preexistente em `components/app-shell.tsx:140`.

| Suíte | Resultado |
| --- | --- |
| `npm run typecheck` | Passou |
| `npm run lint` | 0 erros, 1 aviso preexistente |
| `npm run test:security` | 44 passaram, incluindo 4 novos testes OpenRouter |
| Autenticação/isolamento — `playwright.phase2.config.ts` | 13 passaram |
| Progresso oficial — `playwright.phase3.config.ts` | 8 passaram |
| Landing — `playwright.phase4.config.ts` | 4 passaram |
| Dashboard — `playwright.phase5.config.ts` | 6 passaram |
| Exercício — `playwright.phase6.config.ts` | 6 passaram |
| Chat — `playwright.phase7.config.ts` | 8 passaram |
| OpenAI sem configuração — Fase 7, variante | 1 passou |
| OpenRouter sem chave, com `TUTOR_MODEL=openrouter/free` — Fase 7, variante | 1 passou |
| Falha de envio de e-mail — Fase 2, variante | 1 passou |
| Demo explicitamente habilitado — Fase 1, variante | 1 passou |

Os cenários condicionais pulados nas configurações normais foram executados nas variantes correspondentes. A suíte monolítica legada `site.spec.ts` não foi usada; a regressão usa as suítes específicas das Fases 1–7. A inspeção dos scripts carregados pelo navegador verificou ausência de `OPENROUTER_API_KEY`, `OPENAI_API_KEY` e endpoints dos adaptadores.

A primeira inicialização E2E excedeu os 240 segundos de espera pela rota de saúde do Next, antes de rodar testes. O cache de build de testes foi movido para `.next-test-openrouter-before`, preservado, e a repetição completa passou. Não foi necessária alteração da aplicação para resolver a inicialização. Logs em `.tmp/openrouter-final-*`; falha inicial preservada em `.tmp/openrouter-startup-timeout.log`.

Auditoria final: o adaptador OpenAI é idêntico ao anterior, desconsiderando formatação; a lógica de tentativas e recompensas permanece intacta e não há imports de arquivos `.tmp` pela aplicação. O `loglab` mantém 2 usuários, 1 tentativa, 4 transações de XP, 1 progresso e as 3 migrations anteriores. Identidade e hashes originais preservados, sem conflitos, constraints inválidas, totais inconsistentes ou bancos descartáveis restantes.

Pendência externa: configurar sua chave privadamente, reiniciar o Next e validar a qualidade/disponibilidade com o modelo real. Nenhuma chamada real de IA foi feita; os testes verificam contrato e segurança com mocks, não a qualidade do serviço gratuito.
