# Changelog

Todas as mudanças relevantes deste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adotará versionamento semântico a partir do primeiro release.

## [Não publicado]

### Adicionado

- finalização técnica da Fase 1 com parâmetros canônicos validados, verificação
  de e-mail de uso único, MFA TOTP, códigos de recuperação, rate limit
  distribuído por Redis, abstração SMTP/Mailpit, solicitações do titular,
  retenção configurável e bloqueios obrigatórios de inicialização em produção;
- papéis `FINANCE_ASSISTANT` e `TREASURER`, permissões atômicas das Fases 2 e 3 e
  menus administrativos derivados das permissões efetivas;
- primeira entrega vertical da Fase 2 com equipes, categorias, perfil esportivo
  separado de conta, histórico de vínculo, responsáveis, autorização protegida,
  seletivas, inscrições, histórico de estados, alerta de duplicidade e conversão
  transacional auditada;
- telas administrativas da Fase 2 para equipes, categorias, atletas,
  responsáveis, seletivas, inscrições e conversão;
- primeira entrega vertical da Fase 3 com contas financeiras, categorias,
  centros de custo, planos versionados, cobranças, pagamentos, conciliação,
  alocação parcial, créditos por excedente, transferências, obrigações,
  movimentações, sessão e fechamento do Caixa Fênix;
- telas administrativas da Fase 3 para catálogos, planos, cobranças, pagamentos,
  lançamentos, transferências, contas a pagar/receber e caixa;
- migrations incrementais `fase_1_seguranca_privacidade`,
  `fase_2_esportivo`, `fase_2_guardian_relationship` e
  `fase_3_caixa_fenix`, com UUID, `NUMERIC(19,4)`, constraints, índices,
  relações explícitas e proteções físicas de imutabilidade;
- testes integrados independentes das Fases 2 e 3 contra PostgreSQL e Redis,
  incluindo concorrência na conversão de atleta e na conciliação financeira;
- teste físico do PostgreSQL para identidades UUID, dinheiro exato,
  constraints, FKs, triggers e histórico exato de migrations;
- identidade oficial aplicada com `logo-fenix.png`, preservando a linguagem
  visual já aprovada pelo responsável de Produto;
- documentação consolidada da visão, escopo, requisitos, regras, fluxos, arquitetura, dados, API, UX, identidade, segurança, testes, infraestrutura, roadmap, decisões e viabilidade;
- instruções permanentes em `AGENTS.md`;
- registro explícito de pendências de produto, operação, segurança e LGPD;
- resolução de `PEN-052` e decisão `DT-024`, separando o modelo conceitual completo das migrations físicas incrementais por fase;
- resolução documental de `PEN-001`, aprovação parcial de `PEN-002` e matriz inicial de papéis/permissões da Fase 1 com registro em `DT-022` e `DT-023`;
- modelo conceitual completo preservado em `docs/referencias/schema-conceitual.prisma`, dicionário e diagramas;
- schema Prisma físico com os sete modelos autorizados de identidade, sessão e RBAC;
- primeira migration funcional `fase_1_identidade_acesso`, com UUIDs, relacionamentos explícitos, índices e constraints revisados;
- recorte `fase_1_admin_auditoria`, com login/logout, refresh, expiração por
  inatividade, recuperação/redefinição de senha, administrador inicial restrito,
  RBAC, usuários e auditoria funcional;
- migration `fase_1_admin_auditoria`, com proteção a tentativas, vínculo CSRF e
  `audit_logs` append-only;
- telas de login, recuperação, redefinição, sessão expirada, acesso negado,
  dashboard, usuários, papéis/permissões e auditoria;
- Mailpit efêmero para e-mail local e teste integrado da jornada administrativa
  contra PostgreSQL/SMTP controlados;
- teste automatizado de allowlist que impede modelos, enums e tabelas de fases futuras no recorte físico;
- teste de integração do catálogo PostgreSQL e comparação entre banco migrado e schema físico no CI;
- comandos operacionais para criar, aplicar e consultar migrations Prisma;
- esqueleto de monorepo com aplicações web e API e pacotes compartilhados;
- separação das dependências e configurações TypeScript de frontend e backend por workspace;
- PostgreSQL local por Docker Compose;
- configurações básicas de ambiente, qualidade, testes e build.

### Segurança

- MFA é obrigatório para `ADMIN`, `BOARD`, `FINANCE`,
  `FINANCE_ASSISTANT` e `TREASURER`; segredo TOTP é protegido em repouso e
  nenhum segredo ou código é incluído na auditoria;
- tokens de verificação de e-mail, recuperação, refresh e códigos MFA são
  armazenados somente como hash, com validade, rotação/uso único e limites de
  tentativa;
- rate limit usa Redis em ambientes compartilhados e a aplicação recusa
  staging/produção sem Redis e sem responsáveis/canais críticos configurados;
- lançamentos aprovados, versões de plano, conciliações, alocações e fechamentos
  recebem proteção contra alteração ou exclusão destrutiva no PostgreSQL;
- pagamentos e conciliações usam chave de idempotência, transação serializável e
  proteção contra baixa duplicada;
- menores exigem responsável e autorização válida, mas dados reais de menores
  continuam bloqueados; não há campos médicos nem coleta de saúde;
- dependências transitivas vulneráveis da toolchain foram substituídas por versões corrigidas e fixadas no lockfile; a decisão temporária está registrada em `DT-019`.
- hashes de sessão e recuperação usam armazenamento textual neutro quanto ao algoritmo, com valor não vazio; exclusão física de usuário não remove sessões ou tokens em cascata.
- cookies de autenticação são `HttpOnly`, mutações exigem CSRF vinculado à
  sessão, refresh é rotacionado e reutilização suspeita revoga sessões;
- bootstrap administrativo é de uso único, auditado e bloqueado em produção;
- CORS com credenciais rejeita curinga e configurações críticas falham cedo em
  produção.

### Corrigido

- inicialização da API em desenvolvimento deixou de falhar durante a geração do
  OpenAPI ao declarar explicitamente os tipos dos campos do DTO de health;
- comando `dev:api` passou a compilar com TypeScript e reiniciar o Node em modo
  watch, preservando os metadados de decorators exigidos pela injeção do Nest;
- comparação idempotente de conciliação agora inclui alocações, categoria de
  receita e destino do excedente;
- seleção da tela de pagamentos deixa de manter cobrança ou pagamento que já não
  esteja disponível para conciliação;
- estorno genérico não pode contornar os fluxos específicos de pagamento e
  transferência;
- falhas internas da API mantêm resposta pública genérica e registram evidência
  técnica sem payload sensível no servidor;
- resolução de módulos do backend atualizada de `node10` legado para `Node16`, com teste de regressão da configuração TypeScript.
- resolução de módulos dos pacotes compartilhados atualizada de `node10` legado para `Node16`, com testes de regressão para `types`, `ui` e `validation`.
- inicialização do frontend no Windows corrigida ao substituir a expansão de `WEB_PORT` pela variável nativa `PORT` do Next.js.
- documentação de `DT-019` alinhada à separação real de dependências: Next.js permanece somente em `apps/web`.

### Observação

- a Fase 1 está tecnicamente concluída e as primeiras entregas verticais das
  Fases 2 e 3 estão concluídas somente para ambiente local/teste com dados
  fictícios. Isso não conclui todo o escopo macro dessas fases e não autoriza
  produção, dados reais, menores reais, uploads reais, mensalidade automática,
  PIX/gateway, loja, parceiros ou fórum completo. Responsáveis formais, decisões
  LGPD, segurança, infraestrutura, observabilidade e aceite de produção
  continuam pendentes.

[Não publicado]: https://github.com/Willow0305/Fenix/commits/main
