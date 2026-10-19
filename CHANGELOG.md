# Changelog

Todas as mudanças relevantes deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adotará versionamento semântico a partir do primeiro release.

## [Não publicado]

### Adicionado

- documentação consolidada da visão, escopo, requisitos, regras, fluxos, arquitetura, dados, API, UX, identidade, segurança, testes, infraestrutura, roadmap, decisões e viabilidade;
- instruções permanentes em `AGENTS.md`;
- registro explícito de pendências de produto, operação, segurança e LGPD;
- modelo lógico inicial em Prisma e diagramas Mermaid;
- esqueleto de monorepo com aplicações web e API e pacotes compartilhados;
- separação das dependências e configurações TypeScript de frontend e backend por workspace;
- PostgreSQL local por Docker Compose;
- configurações básicas de ambiente, qualidade, testes e build.

### Segurança

- dependências transitivas vulneráveis da toolchain foram substituídas por versões corrigidas e fixadas no lockfile; a decisão temporária está registrada em `DT-019`.

### Corrigido

- resolução de módulos do backend atualizada de `node10` legado para `Node16`, com teste de regressão da configuração TypeScript.
- inicialização do frontend no Windows corrigida ao substituir a expansão de `WEB_PORT` pela variável nativa `PORT` do Next.js.
- `.gitattributes` passa a fixar finais de linha LF; com `core.autocrlf=true` no Windows, o checkout em CRLF fazia `npm run format:check` (e, portanto, `npm run check`) falhar em todos os arquivos.

### Observação

- esta entrega é a Fase 0 e não contém módulos funcionais de autenticação, atletas, financeiro, loja, parceiros, fórum ou agendamentos.

[Não publicado]: https://github.com/Willow0305/Fenix/commits/main
