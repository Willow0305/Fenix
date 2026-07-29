# Fênix Vôlei

Base técnica e documental da aplicação web oficial de gestão do Time Fênix de Vôlei.

> **Estado em 29/07/2026:** Fase 1 tecnicamente concluída e primeiras entregas verticais das Fases 2 e 3 concluídas para desenvolvimento local/teste, exclusivamente com dados fictícios. Produção, dados reais, uso real com menores e anexos reais permanecem bloqueados pelas decisões institucionais, LGPD, segurança e operação registradas em `PENDENCIAS.md`.

## Objetivo desta entrega

- oferecer autenticação, verificação de e-mail, MFA, RBAC e auditoria;
- administrar equipes, categorias, atletas, responsáveis, seletivas e inscrições;
- operar a primeira entrega do Caixa Fênix com plano versionado, cobranças,
  pagamentos, conciliação, razão, transferências, obrigações e fechamento;
- preservar arquitetura modular, segurança, LGPD e histórico financeiro;
- manter lint, tipos, testes, migrations e builds como gates obrigatórios.

A fonte original é [`referencias/documento_requisitos_fenix_volei_melhorado.pdf`](./referencias/documento_requisitos_fenix_volei_melhorado.pdf). O índice da especificação consolidada está em [`docs/README.md`](./docs/README.md), e decisões que ainda exigem aprovação estão em [`PENDENCIAS.md`](./PENDENCIAS.md).

## Stack

- **Web:** Next.js, React, TypeScript e SCSS Modules;
- **API:** Node.js, NestJS, TypeScript, REST e Swagger/OpenAPI;
- **Dados:** PostgreSQL e Prisma ORM;
- **Validação:** `class-validator` no transporte da API e Zod nas bordas compartilháveis;
- **Qualidade:** ESLint, Prettier, Jest e React Testing Library;
- **Ambiente local:** Docker Compose para PostgreSQL, Redis e Mailpit;
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
│   ├── migrations/       migrations físicas incrementais
│   └── schema.prisma     schema físico da fase vigente
├── docs/
│   ├── referencias/      modelo conceitual não executável
│   └── ...               especificação e decisões
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

3. Inicie PostgreSQL, Redis e o capturador local de e-mail:

   ```bash
   docker compose up -d postgres redis mailpit
   docker compose ps
   ```

4. Aplique as migrations físicas autorizadas:

   ```bash
   npm run prisma:migrate:deploy
   ```

5. Crie o primeiro administrador uma única vez. O comando é bloqueado em
   `production`, exige senha de pelo menos 12 caracteres e falha se já existir
   administrador:

   ```powershell
   $env:BOOTSTRAP_ADMIN_NAME = "Administrador local"
   $env:BOOTSTRAP_ADMIN_EMAIL = "admin@example.test"
   $env:BOOTSTRAP_ADMIN_PASSWORD = "substitua-por-senha-local-forte"
   npm run admin:bootstrap
   Remove-Item Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_PASSWORD
   ```

6. Inicie web e API:

   ```bash
   npm run dev
   ```

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
| `npm run prisma:migrate:deploy` | aplica migrations pendentes de forma não interativa |
| `npm run prisma:migrate:dev` | cria/aplica migration durante desenvolvimento local deliberado |
| `npm run prisma:migrate:diff` | compara o banco configurado com o schema físico e falha em caso de divergência |
| `npm run prisma:migrate:status` | informa o estado das migrations no banco configurado |
| `npm run prisma:migrate:verify` | verifica tabelas, enums, constraints, índices e histórico no PostgreSQL migrado |
| `npm run admin:bootstrap` | cria e audita o primeiro administrador; permitido apenas fora de produção e uma única vez |
| `npm run test:phase1:integration` | valida autenticação, RBAC, CSRF, recuperação, sessão e auditoria contra PostgreSQL |
| `npm run test:phase2:integration` | valida RBAC esportivo, menores fictícios, seletivas, conversão, histórico, concorrência e auditoria |
| `npm run test:phase3:integration` | valida planos, cobranças, conciliação, excedente, idempotência, transferências, aprovações, reversão, obrigações e caixa |
| `npm run smoke` | após o build, inicia web/API, valida web, health, Swagger e OpenAPI, e encerra os processos |
| `npm run check` | executa o gate agregado: formatação, lint, tipos, testes, Prisma e build |

Consulte os scripts de `package.json` como referência executável caso a ferramenta evolua.

## Serviços locais

| Serviço | Endereço padrão | Observação |
|---|---|---|
| Web | `http://localhost:3000` | autenticação e áreas administrativas das Fases 1–3 |
| API | `http://localhost:3333` | API versionada sob `/api/v1` |
| Health | `http://localhost:3333/health` | não expõe segredos |
| Swagger UI | `http://localhost:3333/docs` | somente fora de `production`; responde `404` em produção |
| OpenAPI JSON | `http://localhost:3333/docs/openapi.json` | somente fora de `production`; responde `404` em produção |
| PostgreSQL | `127.0.0.1:5433` | evita conflito com instalações locais na porta 5432; não é publicado na rede externa |
| Redis | `127.0.0.1:6379` | rate limit distribuído; obrigatório em staging/produção |
| Mailpit | `http://127.0.0.1:8025` | caixa de e-mail efêmera exclusivamente local; SMTP em `127.0.0.1:1025` |

Para encerrar o banco sem apagar dados:

```bash
docker compose down
```

Não use `docker compose down -v` sem intenção explícita: ele remove o volume e os dados locais.

## Banco de dados

O arquivo [`prisma/schema.prisma`](./prisma/schema.prisma) é o único schema físico executável e contém apenas modelos promovidos da fase vigente. A visão completa futura permanece em [`docs/referencias/schema-conceitual.prisma`](./docs/referencias/schema-conceitual.prisma), que é documentação e não pode ser usada por `prisma migrate`.

As seis migrations incrementais atuais promovem, nessa ordem:

1. identidade e RBAC;
2. administração e auditoria;
3. segurança, MFA, privacidade e retenção;
4. módulo esportivo;
5. vínculo explícito entre atleta e responsável;
6. Caixa Fênix.

Auditoria, credenciais MFA, versões de plano, conciliações, alocações,
fechamentos e lançamentos financeiros aprovados recebem proteção física
compatível com sua imutabilidade. A instalação foi validada desde banco vazio e
o upgrade foi validado sobre uma baseline composta apenas pelas migrations da
Fase 1.

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
5. [`docs/20-RELATORIO-FASE-1-ADMIN-AUDITORIA.md`](./docs/20-RELATORIO-FASE-1-ADMIN-AUDITORIA.md);
6. [`docs/21-RELATORIO-FINALIZACAO-FASE-1-INICIO-FASES-2-3.md`](./docs/21-RELATORIO-FINALIZACAO-FASE-1-INICIO-FASES-2-3.md);
7. [`PENDENCIAS.md`](./PENDENCIAS.md).

Toda mudança funcional deve atualizar requisitos, regras, fluxo, dados, testes e changelog afetados.

## Segurança e privacidade

- não inclua `.env`, tokens, dumps, comprovantes ou dados pessoais no Git;
- use apenas dados fictícios nas entregas atuais;
- não implemente prontuário ou coleta de saúde;
- não use dados reais de menores nem comprovantes reais;
- não trate esta entrega como autorização de produção;
- reporte vulnerabilidades de forma privada conforme [`SECURITY.md`](./SECURITY.md);
- consulte [`docs/13-SEGURANCA-E-LGPD.md`](./docs/13-SEGURANCA-E-LGPD.md) antes de tratar dados reais.

## Contribuição

Leia [`CONTRIBUTING.md`](./CONTRIBUTING.md). Nenhum módulo é considerado pronto sem validação, tratamento de erros, autorização, testes, lint e build.
