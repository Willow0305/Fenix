# Relatório de entrega — Fase 0

- **Data da validação inicial:** 23/07/2026
- **Data da última validação:** 24/07/2026
- **Estado:** tecnicamente concluída; baseline documental aprovada para orientar a Fase 1 local/teste
- **Escopo:** planejamento, documentação e infraestrutura inicial

## 1. Resultado

A base da Fase 0 está executável e documentada. Frontend e backend são unidades independentes no monorepo, o modelo lógico foi validado pelo Prisma, o PostgreSQL local respondeu pelo Docker Compose e os gates de qualidade passaram. Nenhum módulo funcional previsto para as fases seguintes foi implementado.

William Nascimento aprovou a baseline documental em 24/07/2026 (`PEN-001`). `PEN-002` foi parcialmente resolvida com William Nascimento Oliveira como responsável provisório de Produto; Tecnologia, Financeiro, Privacidade e Segurança ainda precisam de nomeação formal antes de produção. O tratamento de dados de menores permanece bloqueado pelo gate jurídico e de produto `PEN-010`.

## 2. Entregas

### Documentação

- visão, objetivos, escopo, requisitos funcionais e não funcionais;
- regras de negócio, perfis, permissões e fluxos;
- arquitetura, API, UX/UI e identidade visual;
- segurança, LGPD, testes, infraestrutura e deploy;
- roadmap, decisões técnicas e estudo de viabilidade;
- modelo de dados, dicionário e ERD;
- governança em `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` e `PENDENCIAS.md`.

### Base técnica

- `apps/web`: frontend Next.js/React/TypeScript/SCSS;
- `apps/api`: backend NestJS/TypeScript, REST, health check e Swagger fora de produção;
- `packages/config`, `packages/types`, `packages/ui` e `packages/validation`: recursos compartilhados sem acoplamento entre as aplicações;
- na entrega original da Fase 0, `prisma/schema.prisma` continha o modelo conceitual inicial com 66 modelos e 53 enums;
- PostgreSQL 17.10 local, fixado por imagem e digest, publicado somente em `127.0.0.1:5433`;
- npm workspaces, lockfile, ambiente de exemplo, lint, formatação, testes, build, smoke test e CI.

## 3. Separação entre frontend e backend

| Responsabilidade | Local | Dependências próprias |
|---|---|---|
| Frontend | `apps/web` | Next.js, React, SCSS, Sharp e testes de interface |
| Backend | `apps/api` | NestJS, Prisma Client, validação, Swagger e testes HTTP |
| Compartilhado | `packages/*` | configuração, tipos, UI e validações reutilizáveis |
| Orquestração | raiz | ferramentas comuns e scripts dos workspaces |

Não existem importações de `apps/web` por `apps/api`, nem no sentido inverso. Os dois projetos têm manifesto, comandos, build e `tsconfig.json` próprios.

O aviso apontado em `compilerOptions` foi eliminado ao remover a configuração duplicada do plugin Next do `apps/web/tsconfig.json`. A opção passou a existir uma única vez na configuração compartilhada `packages/config/typescript/nextjs.json`; todos os arquivos TypeScript foram resolvidos com `tsc --showConfig` e passaram no typecheck.

No backend, a resolução legada herdada de `moduleResolution: "Node"` também foi removida. A configuração NestJS usa agora o par `module: "Node16"` e `moduleResolution: "Node16"`, validado por teste de regressão sem ocultar a depreciação.

Na revisão de 24/07/2026, a mesma herança legada foi encontrada na configuração dos pacotes compartilhados. `packages/config/typescript/library.json` também passou a usar `Node16`, e testes de regressão verificam os `tsconfig.json` de `@fenix/types`, `@fenix/ui` e `@fenix/validation`. Assim, nenhum workspace permanece em `node10`.

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| instalação reproduzível (`npm ci`) | 807 pacotes adicionados e 814 auditados; 0 vulnerabilidades |
| auditoria (`npm audit --audit-level=high`) | 0 vulnerabilidades |
| formatação e ESLint | aprovados, sem avisos |
| TypeScript | frontend, backend e pacotes aprovados |
| testes automatizados | 6 suítes Jest/8 testes, 4 testes de configuração TypeScript e 1 teste de inicialização aprovados |
| Prisma | schema válido |
| build NestJS | aprovado |
| build Next.js | aprovado; rota `/` pré-renderizada |
| smoke de runtime | web, health, Swagger e OpenAPI responderam HTTP 200 |
| Docker Compose | configuração válida |
| PostgreSQL | container saudável; conexão `fenix:fenix:17.10` confirmada |
| Mermaid | 7 diagramas renderizados sem erro |

A automação visual em navegador interativo não estava disponível no ambiente de execução. A página foi validada por teste de componente, build de produção, smoke HTTP e carregamento dos recursos gerados.

## 5. Decisões principais

- monorepo TypeScript com aplicações implantáveis separadamente;
- frontend em Next.js App Router e backend como monólito modular NestJS;
- REST versionável e documentação OpenAPI disponível somente fora de produção;
- PostgreSQL e Prisma, UUID, instantes UTC, datas civis como `DATE` e dinheiro em `Decimal`;
- armazenamento de arquivos fora do banco, com metadados e acesso privado;
- negação de acesso por padrão, trilha de auditoria e exclusão lógica quando aplicável;
- nenhuma migration funcional foi criada na Fase 0; constraints específicas seriam entregues com os respectivos módulos;
- infraestrutura gerenciada é a topologia recomendada, mas provedor, região e operação ainda exigem aprovação.

As justificativas e alternativas estão em `17-DECISOES-TECNICAS.md`.

## 6. Pontos em aberto e riscos

`PENDENCIAS.md` reúne as decisões abertas e resolvidas. As mais críticas antes de implementar ou usar dados reais são:

- concluir a nomeação de responsáveis de Tecnologia, Financeiro, Privacidade e Segurança;
- transformar a matriz de permissões aprovada em contratos, seeds e testes da Fase 1, sem extrapolar `PEN-008`;
- manter cada nova promoção ao schema físico restrita à tarefa autorizada, conforme `PEN-052`;
- aprovar o tratamento de dados de crianças e adolescentes;
- definir bases legais, retenção, atendimento aos titulares e resposta a incidentes;
- disponibilizar canal privado de segurança;
- confirmar conteúdo institucional, regras financeiras, pagamentos, estoque e logística;
- aprovar provedor, região, backups, RPO/RTO e observabilidade.

Os avisos de descontinuação exibidos pelo npm pertencem a dependências transitivas da toolchain. A auditoria não encontrou vulnerabilidades conhecidas, mas sua evolução deve continuar sendo acompanhada.

## 7. Próximo passo recomendado

O passo recomendado ao encerrar a Fase 0 era iniciar a Fase 1 somente em ambiente
local/teste com dados fictícios. `PEN-052` foi resolvida em 27/07/2026 e os
recortes físicos `fase_1_identidade_acesso` e `fase_1_admin_auditoria` foram
posteriormente entregues. O estado atual e a próxima tarefa constam no
`20-RELATORIO-FASE-1-ADMIN-AUDITORIA.md` e no roadmap. Antes de produção ou dados
reais, continuam obrigatórios `PEN-002`, `PEN-010`, `PEN-011`, `PEN-014` e os
demais gates P0 aplicáveis.

## 8. Atualização posterior à Fase 0

Em 27/07/2026, o modelo conceitual completo foi movido para `docs/referencias/schema-conceitual.prisma` e `prisma/schema.prisma` passou a representar somente o schema físico vigente. A migration `fase_1_identidade_acesso` foi aplicada em PostgreSQL isolado e validada contra uma allowlist de sete tabelas. Esta atualização não altera o escopo histórico nem os resultados de aceite da Fase 0.
