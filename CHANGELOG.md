# Changelog

Todas as mudanças relevantes deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adotará versionamento semântico a partir do primeiro release.

## [Não publicado]

### Fase 2 — Atletas, equipes e inscrições (2026-10-18)

#### Adicionado

- equipes e categorias com páginas públicas e filtro por time (RF-002);
- interessados com consentimento versionado e conversão rastreável em atleta (RF-003, DT-028);
- seletivas com período, vagas e máquina de estados; inscrição pública com regras de menores (RF-004, DT-026);
- atletas: cadastro com documento cifrado e detecção de duplicidade, edição com histórico antes/depois, status com motivo, vínculo com conta e com equipes ao longo do tempo (RF-008 a RF-010);
- área do atleta e do usuário: dados próprios, inscrições e notificações (RF-019, RF-022, DT-029);
- indicadores do painel com definição e origem (RF-020);
- migration `fase2_menores_consentimento` (responsável, ciência e consentimento);
- testes de domínio e 12 testes de integração da Fase 2.

### Fase 1 — Autenticação, permissões e configurações (2026-10-18)

#### Decisões

- Fase 0 aceita; responsável único registrado e fases 1–8 autorizadas (`DT-021`); pendências resolvidas listadas em `PENDENCIAS.md` §12;
- paleta oficial derivada do brasão enviado: `#CD151D`, `#9E0F16`, `#0B0613` (`12-IDENTIDADE-VISUAL.md`);
- autenticação com scrypt, JWT de 15 min e refresh rotativo com detecção de reuso (`DT-022`); organização de módulos (`DT-023`); adaptadores locais de e-mail/arquivos (`DT-024`); paginação (`DT-025`); menores (`DT-026`); mensalidades (`DT-027`).

#### Adicionado

- migration base do schema Prisma e `npm run db:setup` (migrations + seed idempotente do catálogo de permissões, configurações e administrador inicial);
- API: cadastro, login, refresh, logout, recuperação e troca de senha, sessões próprias; administração de usuários, papéis e permissões; auditoria consultável; configurações públicas, financeiras (cifradas com AES-256-GCM) e logos; arquivos com validação de assinatura binária;
- guard global que nega por padrão, verifica permissões no servidor e audita acessos negados; erros em Problem Details; `X-Request-Id`; helmet; rate limiting;
- web: site institucional com identidade Fênix, páginas de autenticação, "Minha conta" e painel administrativo com navegação agrupada por permissão;
- testes unitários (domínio de autenticação, criptografia, componentes) e suíte de integração contra PostgreSQL executada também no CI.

#### Removido

- página técnica de validação da Fase 0 (substituída pelo site institucional).

### Segurança

- Next.js atualizado para 16.4.2 (aviso crítico), Nest para 11.2.7 e overrides de `multer`, `shell-quote`, `sharp`, `postcss`, `deepmerge-ts` e `js-yaml` para versões corrigidas; `npm audit --audit-level=high` sem achados (restam avisos moderados de ferramentas de desenvolvimento).

### Fase 0

#### Adicionado

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


[Não publicado]: https://github.com/Willow0305/Fenix/commits/main
