# Publicar o LogicLab na Netlify

A entrada em `/entrar` oferece o modo convidado, sem banco, e-mail ou senha.
Nesse modo, rascunhos e preferências ficam somente no navegador; o convidado
não recebe acesso administrativo nem pode ler ou gravar dados de contas.
As variáveis de banco e e-mail abaixo são necessárias para os recursos de
contas reais, não para entrar como convidado.

O arquivo `netlify.toml` define Node.js 22, gera o cliente Prisma e compila o
Next.js. A Netlify detecta o framework e instala automaticamente seu adaptador.
Este aplicativo usa rotas de servidor; publique pelo repositório conectado à
Netlify, em vez de enviar apenas a pasta `public`.

## Configuração do projeto

- Base directory: raiz do repositório (onde está `package.json`).
- Build command: `npm run build` (gera o cliente Prisma antes do Next.js).
- Publish directory: `.next`.

## Variáveis no painel da Netlify

Configure estas variáveis para o build e para as funções do servidor:

| Nome | Valor |
| --- | --- |
| `DATABASE_URL` | URL de um PostgreSQL acessível pela Netlify; não use localhost |
| `APP_ENV` | `production` |
| `AUTH_MODE` | `required` |
| `NEXT_PUBLIC_APP_URL` | URL HTTPS final do aplicativo, incluindo `https://` |
| `AUTH_EMAIL_DELIVERY` | `resend` |
| `AUTH_EMAIL_FROM` | Remetente de um domínio verificado na Resend |
| `RESEND_API_KEY` | Chave privada da Resend |

Não envie arquivos `.env` ao repositório e não use prefixo `NEXT_PUBLIC_` em
senhas ou chaves. Configure integrações opcionais conforme `.env.example`.

## Banco de dados

Antes de abrir cadastros, aplique as migrações ao banco escolhido usando
`npx prisma migrate deploy`, com `DATABASE_URL` configurada no ambiente seguro.
Se o banco já tiver dados ou tabelas criadas sem migrações, revise o estado e
faça backup antes. O build gera o cliente Prisma, mas não altera o banco.

## Publicação e diagnóstico

Envie os arquivos atualizados ao repositório conectado e execute um novo deploy.
Se houver cache de uma tentativa anterior, tente um deploy com cache limpo.

O texto `Build script returned non-zero exit code: 2` é apenas o resumo da falha.
Procure a primeira mensagem de erro anterior no Deploy log para identificar a
causa. Um build local aprovado não garante que o adaptador e as variáveis da
Netlify estejam corretos; confirme também o deploy e o cadastro/login online.
