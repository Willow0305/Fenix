# Como executar o Fênix Vôlei (Windows)

Guia passo a passo para subir o banco, a API (backend) e o site (frontend) no seu computador.

## 1. Pré-requisitos (instalar uma única vez)

| Programa | Para quê | Como conferir no terminal |
|---|---|---|
| [Node.js 22 ou 24 (LTS)](https://nodejs.org/) | executa a API e o site | `node --version` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | executa o banco PostgreSQL | `docker --version` |
| [Git](https://git-scm.com/) | controle de versões | `git --version` |

Use o terminal do VS Code (PowerShell ou Git Bash) aberto na pasta do projeto: `C:\Users\William\Desktop\Fenix`.

## 2. Primeira execução

1. **Abra o Docker Desktop** e espere aparecer "Engine running".
2. Instale as dependências:

   ```bash
   npm ci
   ```

3. Confira se existe o arquivo `.env` na raiz do projeto. Ele já foi criado com senhas locais aleatórias. Se precisar recriá-lo, copie o modelo (`Copy-Item .env.example .env` no PowerShell) e troque todos os valores `replace-with-...`.
4. Suba o banco de dados:

   ```bash
   docker compose up -d postgres
   ```

5. Crie as tabelas, as permissões, o plano de contas e o administrador:

   ```bash
   npm run db:setup
   ```

6. (Opcional) Carregue dados **fictícios** para explorar o sistema:

   ```bash
   npm run db:demo
   ```

7. Suba o backend e o frontend juntos:

   ```bash
   npm run dev
   ```

   Aguarde as mensagens de "Ready" do Next.js e "Nest application successfully started". Para parar, pressione `Ctrl + C`.

## 3. Uso no dia a dia

Com o projeto já configurado, basta:

1. abrir o **Docker Desktop**;
2. `docker compose up -d postgres`;
3. `npm run dev`.

Se alguém atualizou o código (`git pull`), rode antes `npm ci` e `npm run db:migrate`.

## 4. Endereços

| O quê | Endereço |
|---|---|
| Site público | http://localhost:3000 |
| Painel administrativo | http://localhost:3000/admin |
| Entrar | http://localhost:3000/entrar |
| Documentação da API (Swagger) | http://localhost:3333/docs |
| Saúde da API | http://localhost:3333/health |

**Acesso de administrador:** e-mail em `SEED_ADMIN_EMAIL` e senha em `SEED_ADMIN_PASSWORD`, ambos no arquivo `.env`.

**E-mails** (recuperação de senha, pedidos, avisos de remessa): em desenvolvimento não são enviados de verdade, ficam como arquivos em `var/mail-outbox/`.

## 5. Brasão do time no site

O site usa, nesta ordem:

1. o logo enviado no painel em **Configurações → Marca e logos → Brasão oficial** (recomendado; vale sem reiniciar);
2. o arquivo `apps/web/public/brand/brasao-fenix.png`;
3. o símbolo da fênix (`apps/web/public/brand/logo-fenix.png`), como reserva.

Para usar o brasão "Time Fênix Volleyball", salve a imagem como PNG, de preferência com fundo transparente, e:

- envie pelo painel (opção 1); **ou**
- salve como `apps/web/public/brand/brasao-fenix.png` e também uma cópia em `referencias/logos/` para registro.

As versões masculina, feminina e da diretoria também podem ser enviadas no mesmo menu.

## 6. Comandos úteis

| Comando | Para quê |
|---|---|
| `npm run dev` | sobe site + API em modo desenvolvimento |
| `npm run dev:web` / `npm run dev:api` | sobe só o site ou só a API |
| `npm run db:migrate` | aplica atualizações do banco |
| `npm run db:seed` | recria permissões e plano de contas (não apaga dados) |
| `npm run db:demo` | dados fictícios de demonstração |
| `npm run check` | verificação completa: formatação, lint, tipos, testes e build |
| `npm run test:integration` | testes contra o banco (Docker precisa estar ligado) |
| `docker compose down` | desliga o banco **sem apagar** os dados |

Não use `docker compose down -v`: o `-v` apaga o banco inteiro.

## 7. Problemas comuns

| Sintoma | Solução |
|---|---|
| `failed to connect to the docker API` | abra o Docker Desktop e aguarde iniciar |
| `Can't reach database server at 127.0.0.1:5433` | rode `docker compose up -d postgres` |
| `Port 3000 (ou 3333) is already in use` | feche outra execução do `npm run dev` ou reinicie o terminal |
| erro de tabela inexistente | rode `npm run db:migrate` |
| API não sobe, com centenas de erros de TypeScript ou `Cannot convert undefined or null to object` | pare o `npm run dev` e rode `npm run prisma:generate` (cliente do Prisma desatualizado) |
| "Sua sessão foi encerrada por inatividade" | esperado: o painel encerra a sessão após 30 min sem uso e 12 h após o login (`DT-036`) |
| login com "Papel padrão ausente" | rode `npm run db:seed` |
| `npm run check` falha em formatação com CRLF | rode `npm run format` (o `.gitattributes` já força LF em novos checkouts) |
| site abre mas sem dados | rode `npm run db:demo` ou cadastre pelo painel |
