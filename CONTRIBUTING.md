# Como contribuir

## Antes de começar

1. Leia [`AGENTS.md`](./AGENTS.md).
2. Consulte todos os arquivos em [`docs/`](./docs/README.md).
3. Confirme a fase vigente em [`docs/16-ROADMAP.md`](./docs/16-ROADMAP.md).
4. Verifique dúvidas e decisões abertas em [`PENDENCIAS.md`](./PENDENCIAS.md).
5. Não altere um requisito ou uma decisão arquitetural sem registrar a mudança.

## Ambiente local

Pré-requisitos e comandos atualizados estão no [`README.md`](./README.md). O fluxo normal é:

```bash
npm ci
docker compose up -d postgres
npm run check
```

Use somente dados fictícios no desenvolvimento. Nunca copie credenciais ou dados pessoais reais para fixtures, testes, issues ou logs.

## Fluxo de trabalho

- crie uma branch curta a partir da base atual;
- mantenha cada mudança focada em um módulo ou objetivo;
- prefira commits pequenos e descritivos;
- atualize documentação e testes no mesmo conjunto de mudanças;
- preserve o lockfile quando dependências mudarem;
- não inclua `.env`, dumps, uploads ou segredos;
- abra o pull request com riscos, decisões, validações e pendências.

Sugestão de nomes:

```text
feat/auth-session
fix/monthly-fee-rounding
docs/cash-rules
chore/update-tooling
```

Sugestão de commits:

```text
feat(auth): add refresh token rotation
fix(finance): prevent duplicate settlement
docs(store): define campaign cancellation flow
test(rbac): cover denied administrative action
```

## Padrões de código

- TypeScript em modo `strict`;
- não usar `any` sem justificativa técnica documentada;
- controllers e componentes de interface não contêm regra de negócio;
- entradas externas são validadas;
- erros retornados não expõem implementação ou dados privados;
- dinheiro usa tipo decimal, nunca ponto flutuante;
- instantes são armazenados em UTC;
- permissões são verificadas no backend;
- ações sensíveis e financeiras mantêm trilha de auditoria;
- nomes e contratos públicos permanecem em inglês técnico consistente no código; documentação e textos de produto podem usar português.

## Banco de dados

- mantenha `prisma/schema.prisma` restrito aos modelos promovidos da fase e tarefa autorizadas;
- não copie modelos futuros de `docs/referencias/schema-conceitual.prisma` para o schema físico sem promoção documentada;
- gere uma migration versionada por recorte, com nome que identifique fase e objetivo;
- revise SQL gerado, índices, constraints e política `onDelete`;
- não use `db push` em produção;
- não remova coluna ou tabela com dados sem plano de migração, retenção e rollback;
- testes de persistência devem usar PostgreSQL, não um banco com semântica diferente;
- valide por allowlist que a migration não criou tabelas ou enums de fases futuras;
- em banco descartável migrado, execute `prisma:migrate:verify` e `prisma:migrate:diff` para conferir catálogo e paridade com o schema;
- seeds não podem conter dados reais.

## Testes

Uma mudança deve cobrir:

- caminho esperado;
- validação e erros relevantes;
- acesso negado;
- transições de estado inválidas;
- repetição/idempotência quando crítica;
- concorrência e precisão em finanças/estoque quando aplicável.

Antes do pull request:

```bash
npm run check
```

O comando agregado inclui formatação, lint, tipos, testes, validação do Prisma e build. Execute também E2E e verificações específicas quando os scripts correspondentes existirem.

## Documentação e decisões

- requisito novo ou alterado: atualize `docs/02` ou `docs/03`, regras e fluxos relacionados;
- decisão arquitetural: adicione uma entrada a `docs/17-DECISOES-TECNICAS.md`;
- questão sem resposta: registre em `PENDENCIAS.md`, com recomendação e fase bloqueada;
- mudança relevante: atualize `CHANGELOG.md`;
- vulnerabilidade: siga `SECURITY.md`, sem issue pública.

## Checklist do pull request

- [ ] a mudança pertence à fase atual;
- [ ] requisitos e regras estão rastreados;
- [ ] validação, erros e autorização foram tratados;
- [ ] testes relevantes foram adicionados;
- [ ] `npm run check` passou;
- [ ] migrations e contratos foram revisados;
- [ ] documentação e changelog foram atualizados;
- [ ] não há segredo, dado pessoal, dump ou arquivo privado;
- [ ] riscos, limitações e próximos passos estão descritos.
