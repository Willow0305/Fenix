# Relatório de entrega — Fase 0

**Data da validação:** 23/07/2026  
**Estado:** tecnicamente concluída; aceite formal pendente  
**Escopo:** planejamento, documentação e infraestrutura inicial

## 1. Resultado

A base da Fase 0 está executável e documentada. Frontend e backend são unidades independentes no monorepo, o modelo lógico foi validado pelo Prisma, o PostgreSQL local respondeu pelo Docker Compose e os gates de qualidade passaram. Nenhum módulo funcional previsto para as fases seguintes foi implementado.

O encerramento formal ainda depende da aprovação da especificação consolidada (`PEN-001`) e da definição dos responsáveis (`PEN-002`). O tratamento de dados de menores permanece bloqueado pelo gate jurídico e de produto `PEN-010`.

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
- `prisma/schema.prisma`: modelo lógico inicial com 66 modelos e 53 enums;
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

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| instalação reproduzível (`npm ci`) | 809 pacotes instalados; 0 vulnerabilidades |
| auditoria (`npm audit --audit-level=high`) | 0 vulnerabilidades |
| formatação e ESLint | aprovados, sem avisos |
| TypeScript | frontend, backend e pacotes aprovados |
| testes automatizados | 6 suítes Jest/8 testes, 1 teste TypeScript e 1 teste de inicialização aprovados |
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
- nenhuma migration funcional nesta fase; constraints específicas serão entregues com os respectivos módulos;
- infraestrutura gerenciada é a topologia recomendada, mas provedor, região e operação ainda exigem aprovação.

As justificativas e alternativas estão em `17-DECISOES-TECNICAS.md`.

## 6. Pontos em aberto e riscos

`PENDENCIAS.md` reúne 51 decisões abertas. As mais críticas antes de implementar ou usar dados reais são:

- aprovar a baseline documental e nomear responsáveis;
- concluir a matriz de permissões e os fluxos de cadastro;
- aprovar o tratamento de dados de crianças e adolescentes;
- definir bases legais, retenção, atendimento aos titulares e resposta a incidentes;
- disponibilizar canal privado de segurança;
- confirmar conteúdo institucional, regras financeiras, pagamentos, estoque e logística;
- aprovar provedor, região, backups, RPO/RTO e observabilidade.

Os avisos de descontinuação exibidos pelo npm pertencem a dependências transitivas da toolchain. A auditoria não encontrou vulnerabilidades conhecidas, mas sua evolução deve continuar sendo acompanhada.

## 7. Próximo passo recomendado

Realizar a revisão formal da Fase 0, decidir `PEN-001`, `PEN-002` e os gates P0 aplicáveis e somente então abrir a Fase 1. A primeira implementação funcional deve seguir o roadmap, criar migrations por módulo e atualizar requisitos, regras, testes, documentação e changelog no mesmo conjunto de mudanças.
