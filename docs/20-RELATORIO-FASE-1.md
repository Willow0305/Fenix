# Relatório de entrega — Fase 1

**Data da validação:** 18/10/2026  
**Estado:** implementada; validada por lint, testes, build e smoke  
**Escopo:** autenticação, sessões, usuários, papéis e permissões, auditoria, configurações do time, logos e site institucional  
**Commit:** `cdbfdb9`

## 1. Resultado

A fundação de identidade e governança está operacional. Toda rota da API nega acesso por padrão; rotas administrativas exigem permissões granulares verificadas no servidor, e tentativas negadas são auditadas. O site institucional exibe conteúdo editável pelo painel, sem deploy.

## 2. Entregas

### Backend (`apps/api`)

| Módulo | Capacidades |
|---|---|
| `common` | configuração tipada e validada por ambiente, Prisma, erros em Problem Details, `X-Request-Id`, paginação, auditoria, criptografia (scrypt, JWT HS256, AES-256-GCM), portas de e-mail e armazenamento |
| `auth` | cadastro, login, refresh rotativo, logout, recuperação e troca de senha, sessões próprias, guard global |
| `access` | catálogo de permissões e papéis de sistema, administração de usuários, papéis e permissões, consulta de auditoria |
| `media` | upload com validação de assinatura binária e leitura conforme classificação |
| `settings` | dados públicos do time, dados financeiros cifrados (PIX/banco) e logos por contexto |

### Frontend (`apps/web`)

- site público: início, sobre, contato, termos e privacidade;
- autenticação: entrar, cadastro, recuperar e redefinir senha;
- "Minha conta": perfil e segurança (senha e sessões);
- painel: usuários, papéis e permissões, configurações e logos, auditoria; navegação agrupada por permissão.

### Dados e operação

- migration base com todo o modelo lógico (`20261019032632_baseline`);
- `npm run db:setup` (migrations + seed idempotente do catálogo, configuração e administrador inicial);
- CI estendida com migrations e testes de integração contra PostgreSQL.

## 3. Requisitos atendidos

| Requisito | Situação |
|---|---|
| RF-001 site institucional | atendido (conteúdo de times, notícias e loja completado nas fases seguintes) |
| RF-005 criação de conta | atendido; perfil privilegiado só por administrador |
| RF-006 login, logout, recuperação | atendido, sem enumeração de contas |
| RF-007 perfis e permissões | atendido com RBAC + permissões granulares |
| RF-023 configurações públicas | atendido, refletem sem deploy |
| RF-024 auditoria | base implantada e usada por todos os módulos |
| RF-039 logos por contexto | atendido (oficial, masculino, feminino, diretoria, capa) |
| RCF-014 configurações do time | atendido (PIX/banco cifrados e não públicos) |

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| `npm run check` | aprovado |
| testes unitários (API) | domínio de autenticação e criptografia, inicialização segura em produção |
| testes de integração | 15 cenários: cadastro, credenciais, bloqueio, rotação e reuso de refresh, origem, logout, troca e recuperação de senha, permissões, autoproteção de papéis, auditoria, configurações, uploads |
| smoke | web, health, Swagger e OpenAPI com HTTP 200 |
| `npm audit --audit-level=high` | sem achados após atualização de dependências |

## 5. Decisões principais

`DT-021` (aceite e responsável único), `DT-022` (autenticação e RBAC), `DT-023` (organização dos módulos), `DT-024` (adaptadores locais), `DT-025` (paginação), `DT-026` (menores) e `DT-027` (regras de mensalidade antecipadas). Paleta oficial derivada do brasão em `12-IDENTIDADE-VISUAL.md`.

## 6. Pontos em aberto e riscos

- MFA para perfis privilegiados antes de produção (`PEN-013`);
- provedores reais de e-mail e armazenamento (`PEN-042`); hoje são adaptadores locais;
- textos jurídicos de termos e privacidade a aprovar (`PEN-006`, `PEN-011`).

## 7. Próximo passo

Fase 2 — atletas e inscrições ([21-RELATORIO-FASE-2](./21-RELATORIO-FASE-2.md)).
