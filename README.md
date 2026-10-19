# Fênix Vôlei

Aplicação web oficial de gestão do Time Fênix de Vôlei: site institucional, área do atleta e do cliente, loja e painel administrativo esportivo e financeiro.

> **Estado:** desenvolvimento incremental por fases (ver [`docs/16-ROADMAP.md`](./docs/16-ROADMAP.md)). Fases 0 a 5 implementadas e validadas; relatórios em [`docs/19`](./docs/19-RELATORIO-FASE-0.md) a [`docs/24`](./docs/24-RELATORIO-FASE-5.md).

## O que já funciona

| Área | Funcionalidades |
|---|---|
| Site público | início, sobre, times, seletivas com inscrição, "Quero jogar no Fênix", loja, pré-vendas, contato, termos e privacidade — conteúdo editável pelo painel |
| Conta | cadastro, login, recuperação e troca de senha, sessões revogáveis; área do atleta (dados, mensalidades, PIX e comprovante), inscrições, pedidos, favoritos e notificações |
| Esportivo | atletas com histórico, equipes e categorias, interessados, seletivas e análise de inscrições, conversão rastreável em atleta |
| Mensalidades | planos, geração mensal, pagamentos parciais, comprovante PIX, desconto/isenção, estorno |
| Caixa Fênix | contas, categorias, centros de custo, lançamentos, estornos, transferências, saldo inicial, contas a pagar/receber, conciliação, fechamento e reabertura |
| Loja | produtos com variações e estoque, carrinho, checkout (também sem conta), pagamento PIX manual, pedidos, favoritos |
| Remessas | pré-vendas por período, mínimo pago, relatório para a malharia, chegada com aviso aos compradores e retirada |
| Governança | papéis e permissões granulares, auditoria imutável, painel com indicadores, notificações internas |

A fonte original é [`referencias/documento_requisitos_fenix_volei_melhorado.pdf`](./referencias/documento_requisitos_fenix_volei_melhorado.pdf). O índice da especificação consolidada está em [`docs/README.md`](./docs/README.md), e decisões que ainda exigem aprovação estão em [`PENDENCIAS.md`](./PENDENCIAS.md).

## Stack

- **Web:** Next.js, React, TypeScript e SCSS Modules;
- **API:** Node.js, NestJS, TypeScript, REST e Swagger/OpenAPI;
- **Dados:** PostgreSQL e Prisma ORM;
- **Validação:** `class-validator` no transporte da API e Zod nas bordas compartilháveis;
- **Qualidade:** ESLint, Prettier, Jest e React Testing Library;
- **Ambiente local:** Docker Compose para PostgreSQL;
- **Organização:** npm workspaces.

## Estrutura

```text
.
├── apps/
│   ├── api/              API NestJS
│   └── web/              aplicação Next.js
├── packages/
│   ├── config/           configuração compartilhada
│   ├── types/            tipos estáveis
│   ├── ui/               componentes visuais
│   └── validation/       schemas reutilizáveis
├── prisma/
│   └── schema.prisma     modelo lógico inicial
├── docs/                 especificação e decisões
├── referencias/          documento e arte oficial de origem
├── uploads/              somente apoio local; não é storage de produção
├── AGENTS.md
├── PENDENCIAS.md
├── docker-compose.yml
└── package.json
```

### Fronteiras entre frontend e backend

- `apps/web` é o frontend implantável: possui Next.js, React, SCSS e suas dependências de teste;
- `apps/api` é o backend implantável: possui NestJS, Prisma Client e suas dependências de teste;
- uma aplicação não importa código da outra;
- somente contratos estáveis, validações e componentes reutilizáveis podem ficar em `packages`;
- o `package.json` da raiz não possui dependências de runtime das aplicações: ele apenas coordena workspaces e ferramentas comuns;
- cada aplicação mantém seu próprio `tsconfig.json`, herdando apenas regras comuns de `packages/config/typescript`.

## Pré-requisitos

- Node.js compatível com o campo `engines` do `package.json`;
- npm compatível com o lockfile;
- Docker Desktop/Engine com Compose v2;
- Git.

Confira:

```bash
node --version
npm --version
docker --version
docker compose version
```

## Início rápido

1. Instale exatamente as dependências do lockfile:

   ```bash
   npm ci
   ```

   Use `npm install` somente ao atualizar dependências de forma intencional e revise a alteração do `package-lock.json`.

2. Copie as configurações locais:

   ```bash
   cp .env.example .env
   ```

   No PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   `.env` é ignorado pelo Git. Não use credenciais reais no arquivo de exemplo.

3. Inicie o PostgreSQL:

   ```bash
   docker compose up -d postgres
   docker compose ps
   ```

4. Aplique as migrations e crie o catálogo de permissões, a configuração do time e o administrador inicial (`SEED_ADMIN_*` do `.env`):

   ```bash
   npm run db:setup
   ```

5. Inicie web e API:

   ```bash
   npm run dev
   ```

   Opcional: carregue dados fictícios para explorar o sistema com `npm run db:demo`.

   Acesse `http://localhost:3000/entrar` com `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. E-mails (como recuperação de senha) são gravados em `var/mail-outbox/` durante o desenvolvimento.

Os endereços padrão e as portas podem ser alterados pelas variáveis documentadas em `.env.example`.
O Next.js lê a porta do frontend pela variável padrão `PORT`; a API usa `API_PORT`.

## Comandos

| Comando | Finalidade |
|---|---|
| `npm run dev` | inicia web e API em desenvolvimento |
| `npm run dev:web` | inicia somente Next.js |
| `npm run dev:api` | inicia somente NestJS |
| `npm run lint` | executa análise estática nos workspaces |
| `npm test` | executa os testes iniciais |
| `npm run build` | gera builds de produção |
| `npm run format` | aplica Prettier |
| `npm run format:check` | confere formatação sem alterar |
| `npm run typecheck` | valida os tipos sem emitir arquivos |
| `npm run prisma:format` | formata o schema Prisma |
| `npm run prisma:generate` | gera o cliente Prisma a partir do schema validado |
| `npm run prisma:validate` | valida o modelo lógico Prisma |
| `npm run db:migrate` | aplica migrations pendentes (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | cria nova migration a partir do schema (desenvolvimento) |
| `npm run db:seed` | sincroniza permissões/papéis e cria o administrador inicial, se não houver |
| `npm run db:setup` | `db:migrate` + `db:seed` |
| `npm run db:demo` | dados fictícios de demonstração (recusa produção) |
| `npm run test:integration` | testes de integração da API contra o PostgreSQL do `.env` |
| `npm run smoke` | após o build, inicia web/API, valida web, health, Swagger e OpenAPI, e encerra os processos |
| `npm run check` | executa o gate agregado: formatação, lint, tipos, testes, Prisma e build |

Consulte os scripts de `package.json` como referência executável caso a ferramenta evolua.

## Serviços locais

| Serviço | Endereço padrão | Observação |
|---|---|---|
| Web | `http://localhost:3000` | site; painel em `/admin` |
| API | `http://localhost:3333` | REST em `/api/v1` (o navegador usa o proxy da web) |
| Health | `http://localhost:3333/health` | não expõe segredos |
| Swagger UI | `http://localhost:3333/docs` | somente fora de `production`; responde `404` em produção |
| OpenAPI JSON | `http://localhost:3333/docs/openapi.json` | somente fora de `production`; responde `404` em produção |
| PostgreSQL | `127.0.0.1:5433` | evita conflito com instalações locais na porta 5432; não é publicado na rede externa |

Para encerrar o banco sem apagar dados:

```bash
docker compose down
```

Não use `docker compose down -v` sem intenção explícita: ele remove o volume e os dados locais.

## Banco de dados

O modelo está em [`prisma/schema.prisma`](./prisma/schema.prisma) e é aplicado por migrations versionadas em [`prisma/migrations/`](./prisma/migrations/) (`npm run db:migrate`).

Regras permanentes:

- UUID como chave primária;
- instantes em UTC e datas civis como `DATE`;
- dinheiro como `Decimal/Numeric`, nunca `float`;
- exclusão lógica e auditoria onde exigidas;
- movimentos financeiros confirmados sem exclusão destrutiva;
- arquivos fora do banco, com metadados e URL/chave segura.

## Documentação

Comece por:

1. [`AGENTS.md`](./AGENTS.md);
2. [`docs/README.md`](./docs/README.md);
3. [`docs/16-ROADMAP.md`](./docs/16-ROADMAP.md);
4. [`docs/19-RELATORIO-FASE-0.md`](./docs/19-RELATORIO-FASE-0.md);
5. [`PENDENCIAS.md`](./PENDENCIAS.md).

Toda mudança funcional deve atualizar requisitos, regras, fluxo, dados, testes e changelog afetados.

## Segurança e privacidade

- não inclua `.env`, tokens, dumps, comprovantes ou dados pessoais no Git;
- use apenas dados fictícios durante esta fase;
- não implemente prontuário ou coleta de saúde;
- reporte vulnerabilidades de forma privada conforme [`SECURITY.md`](./SECURITY.md);
- consulte [`docs/13-SEGURANCA-E-LGPD.md`](./docs/13-SEGURANCA-E-LGPD.md) antes de tratar dados reais.

## Contribuição

Leia [`CONTRIBUTING.md`](./CONTRIBUTING.md). Nenhum módulo é considerado pronto sem validação, tratamento de erros, autorização, testes, lint e build.
