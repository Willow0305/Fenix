# Relatório — `fase_1_admin_auditoria`

- **Data:** 27/07/2026
- **Ambiente autorizado:** local/teste, somente dados fictícios
- **Estado do recorte:** implementado e validado
- **Estado da Fase 1:** ainda incompleta

## 1. Resumo

Foi entregue a base administrativa mínima da Fase 1: autenticação por e-mail e
senha, logout, recuperação/redefinição por código, sessões revogáveis e
rotativas, expiração por inatividade, CSRF, bloqueio temporário, comando seguro
para o primeiro administrador, RBAC, gerenciamento básico de usuários e trilha
funcional de auditoria.

O frontend possui telas públicas de autenticação e um shell administrativo com
dashboard, usuários, perfis/permissões e auditoria. Permissões são validadas no
servidor; o menu cliente é apenas uma projeção da autorização. Nenhuma
funcionalidade de atletas, menores, mensalidades, Caixa, loja, fórum, parceiros,
documentos sensíveis ou dados médicos foi criada.

## 2. Estrutura criada

```text
apps/api/src/
├── access-control/  catálogo, permissões, guard e bootstrap
├── audit/           ações, persistência, consulta e sanitização
├── auth/            login, sessão, refresh, CSRF e recuperação
├── common/          Problem Details, request ID, cookies e criptografia
├── database/        ciclo de vida do Prisma
└── users/           casos administrativos de conta

apps/web/app/
├── login/
├── recuperar-senha/
├── redefinir-senha/
├── acesso-negado/
├── sessao-expirada/
├── admin/
│   ├── usuarios/
│   ├── perfis/
│   └── auditoria/
└── lib/api-client.ts
```

## 3. Arquivos criados

- backend: todos os arquivos TypeScript sob `apps/api/src/access-control`,
  `audit`, `auth`, `common`, `database` e `users`, além de
  `apps/api/src/bootstrap-admin.ts`;
- frontend: rotas listadas acima, `admin-shell.tsx`, estilos de autenticação e
  administração e `apps/web/app/lib/api-client.ts`;
- banco:
  `prisma/migrations/20260727000200_fase_1_admin_auditoria/migration.sql`;
- teste integrado: `scripts/phase1-auth-integration.mjs`;
- relatório: este documento.

## 4. Arquivos modificados

- aplicação/configuração: `.env.example`, `docker-compose.yml`, `package.json`,
  `package-lock.json`, `apps/api/package.json`, módulos/configuração da API,
  página inicial/layout/testes do web e `.github/workflows/ci.yml`;
- persistência: `prisma/schema.prisma` e testes de escopo/catalogação das
  migrations;
- governança: `README.md`, `PENDENCIAS.md`, `CHANGELOG.md` e documentos de
  regras, permissões, fluxos, arquitetura, dados, API, UX, segurança, testes,
  deploy, roadmap, decisões e ERD.

O repositório já continha alterações da subentrega imediatamente anterior
`fase_1_identidade_acesso`; elas foram preservadas.

## 5. Decisões técnicas

- bcrypt configurável para senha; HMAC com pepper separado para refresh, CSRF e
  recuperação; nenhum valor sensível é persistido em claro;
- access JWT HS256 de 45 minutos em cookie `HttpOnly`; refresh opaco rotativo,
  vinculado à sessão e protegido contra reutilização;
- CSRF por cookie/header de duplo envio, com hash vinculado à sessão;
- bloqueio por conta e inatividade com valores provisórios configuráveis,
  mantendo `PEN-013` aberta;
- primeiro administrador criado somente por comando, sob trava transacional,
  uma vez e nunca em `production`;
- papéis físicos `ADMIN`, `BOARD`, `FINANCE` e `USER`, sem conceder capacidades
  de fases futuras;
- invariável do último administrador ativo serializada por advisory lock no
  PostgreSQL;
- auditoria minimizada, contexto hasheado, consulta por `audit.read` e trigger
  físico append-only;
- Mailpit fixado por versão/digest somente para e-mail efêmero local;
- Problem Details, CORS explícito, configuração segura com falha antecipada e
  CI com teste integrado.

## 6. Pendências e bloqueios

- aprovar duração exata de inatividade/código, tentativas, bloqueio, refresh,
  limite de sessões, MFA, verificação de e-mail e rate limit distribuído;
- definir provedor/remetente de e-mail, topologia/domínios e observabilidade;
- aprovar logos oficiais, conteúdo institucional e paleta canônica;
- nomear responsáveis formais de Tecnologia, Financeiro, Privacidade e
  Segurança;
- fechar LGPD, bases legais, retenção, direitos do titular, menores e canal de
  segurança/resposta a incidente;
- executar revisão visual/acessibilidade em navegador e testes não funcionais
  aprovados;
- concluir configurações e arquivos institucionais restantes da Fase 1.

Produção, staging público, dados reais e qualquer coleta médica permanecem
bloqueados.

## 7. Comandos principais

```text
npm install
npm run prisma:generate
npm run typecheck --workspace=@fenix/api
npm test --workspace=@fenix/api -- --runInBand
npm run prisma:migrate:deploy
npm run prisma:migrate:verify
npm run prisma:migrate:diff
npm run test:phase1:integration
npm test
npm run lint
npm run build
npm run check
npm audit --audit-level=high
npm run smoke
docker compose config --quiet
docker compose up -d --wait postgres mailpit
docker compose ps
```

## 8. Resultado dos testes

- migrations aplicadas desde banco PostgreSQL vazio e reaplicadas sem
  pendência;
- 4 testes de catálogo físico aprovados e paridade Prisma sem diferenças;
- integração aprovada: login, logout, refresh/reuso, recuperação, RBAC, CSRF,
  inatividade, último administrador e auditoria append-only;
- gate de workspace: 26 testes aprovados — 6 de escopo/startup, 4 de
  configuração TypeScript, 1 de UI compartilhada, 2 de validação, 10 da API e 3
  do frontend;
- smoke: web, health, Swagger e OpenAPI responderam HTTP 200;
- o banco temporário de integração foi removido ao final.

A revisão visual interativa não pôde ser executada porque a sessão não possuía
navegador conectado. Testes de componente, build e smoke passaram, mas a revisão
visual/acessibilidade permanece pendência explícita do aceite integral da Fase 1.

## 9. Lint

`npm run lint` e `npm run format:check` foram aprovados sem avisos. A configuração
desativa `consistent-type-imports` somente no código NestJS, onde classes
injetáveis e DTOs precisam existir em runtime para metadata de DI/validação; as
demais regras estritas, inclusive proibição de `any`, permanecem ativas.

## 10. Build

`npm run build` foi aprovado para API NestJS, frontend Next.js e pacotes. O
Next.js compilou e pré-renderizou 12 páginas, incluindo todas as rotas públicas e
administrativas deste recorte. `npm run check`, `npm audit --audit-level=high` e
`docker compose config --quiet` também passaram; a auditoria encontrou 0
vulnerabilidades.

## 11. Próxima etapa recomendada

Resolver os insumos institucionais/visuais e promover
`fase_1_configuracoes_institucionais` como nova tarefa isolada. Em paralelo,
fechar `PEN-013` e os gates de produção. Fases 2 e 3 só podem ser consideradas
depois do aceite formal integral da Fase 1; não foram antecipadas neste recorte.
