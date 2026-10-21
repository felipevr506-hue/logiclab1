# Operação segura do LogicLab

## Ambientes

- `development`: dados descartáveis, `AUTH_MODE=demo` permitido e links locais de recuperação.
- `staging`: cópia sem dados pessoais reais, `AUTH_MODE=required`, webhooks em sandbox e migrações ensaiadas.
- `production`: HTTPS obrigatório, segredos no cofre do provedor, PostgreSQL gerenciado, e-mail transacional, observabilidade e billing autenticado.

Nunca compartilhe banco, chaves, buckets ou webhooks entre staging e produção.

## Deploy e migrations

1. Gere um backup verificável antes de cada migration de produção.
2. Revise SQL e impacto em tabelas grandes; prefira mudanças aditivas e backfill em lotes.
3. Execute primeiro em staging com volume representativo.
4. Publique código compatível com schema antigo e novo quando a mudança exigir etapas.
5. Só remova colunas depois de confirmar que nenhuma versão ativa as utiliza.

## Backup PostgreSQL

- Frequência inicial recomendada: snapshot diário e recuperação ponto no tempo quando o provedor oferecer.
- Retenção inicial: 30 dias, ajustada às obrigações e ao volume real.
- Responsável: pessoa explicitamente definida na operação, não “o sistema”.
- Criptografia: em trânsito e repouso, com acesso restrito e auditado.
- Restauração: teste trimestral em ambiente isolado; registre duração, integridade e pendências.

Os arquivos em `.data` são adequados apenas ao MVP de uma única instância. Eles não substituem backup de produção.

## Alertas mínimos

- taxa elevada de erro 5xx ou falha de health check;
- banco indisponível ou pool esgotado;
- falhas repetidas de login e rate limit anormal;
- webhook inválido ou acumulado sem processamento;
- Tutor externo indisponível, latência ou orçamento acima do limite;
- executor com timeout ou erro muito acima da linha de base;
- build/deploy ou migration interrompidos.

## Incidentes

Preserve logs sem senhas, tokens, código do aluno ou payload financeiro completo. Registre início, impacto, decisões, restauração e ações preventivas. Comunique usuários quando aplicável e siga orientação jurídica para incidentes envolvendo dados pessoais.
