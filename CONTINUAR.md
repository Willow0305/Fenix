# Continuidade do desenvolvimento — guia para o próximo agente

Este arquivo permite que outro chat ou agente continue exatamente de onde o trabalho parou. Leia-o inteiro antes de alterar qualquer coisa.

## Prompt para colar no novo chat

> Você vai continuar o desenvolvimento do sistema Fênix Vôlei no repositório `C:\Users\William\Desktop\Fenix`, branch `desenvolvimento`. Leia, nesta ordem: `CONTINUAR.md`, `AGENTS.md`, `docs/16-ROADMAP.md`, `PENDENCIAS.md` (seção 12, "Resolvidas") e `docs/27-RELATORIO-FASE-8.md`. As fases 0 a 8 estão implementadas e commitadas. Antes de qualquer novo desenvolvimento, confirme com o responsável qual pendência de produção atacar (ver `docs/27-RELATORIO-FASE-8.md` §7); a seção 5 deste guia ficou como histórico do plano executado. O responsável único do projeto autorizou todas as fases e delegou as decisões técnicas: decida sozinho usando as recomendações de `PENDENCIAS.md` e registre-as em `docs/17-DECISOES-TECNICAS.md`. Pergunte apenas o que for decisão de negócio impossível de inferir. Ao fim de cada fase: `npm run check` e `npm run test:integration` verdes, relatório `docs/2X-RELATORIO-FASE-N.md` no padrão dos anteriores, atualização de CHANGELOG, roadmap, 02-REQUISITOS (matriz de estado), 10-API e decisões, e commit com a linha `Co-Authored-By` usada nos commits anteriores. Responda sempre em português.

## 1. Contexto

- **Responsável:** usuário único (William), dono do produto e de todas as áreas. Autorizou as fases 1 a 8 (`DT-021`), com cadastro livre de usuários, mensalidades sem multa/juros com pagamento parcial e menores com responsável (`DT-026`). Fala português e prefere explicações diretas.
- **Paleta oficial:** `#CD151D` (vermelho), `#9E0F16` (vermelho escuro), `#0B0613` (preto), branco (`docs/12`). O brasão completo ainda não está no repositório: ver `docs/COMO-EXECUTAR.md` §5.
- **Como subir o ambiente:** `docs/COMO-EXECUTAR.md`.

## 2. Estado atual

| Fase | Tema | Commit | Relatório |
|---:|---|---|---|
| 0 | Planejamento e infraestrutura | `4b287ef` (correção LF) | `docs/19` |
| 1 | Autenticação, permissões, configurações, site | `cdbfdb9` | `docs/20` |
| 2 | Atletas, equipes, interessados, seletivas | `b9833f9` | `docs/21` |
| 3 | Mensalidades e Caixa Fênix | `9563b67` | `docs/22` |
| 4 | Loja, estoque, carrinho, pedidos | `0291d5c` | `docs/23` |
| 5 | Remessas (pré-vendas) | `93c6d87` | `docs/24` |
| — | Documentação atualizada, `db:demo`, este guia | commits seguintes | — |
| 6 | Parceiros e profissionais | ver `git log` | `docs/25` |
| 7 | Comunicação (notícias, eventos, fórum) | ver `git log` | `docs/26` |
| 8 | Relatórios, auditoria final, otimizações | ver `git log` | `docs/27` |

Testes: 82 unitários de API e 7 web (`npm test`), mais 71 de integração em `apps/api/test/phase1..8-*.int-spec.ts` (`npm run test:integration`).

**Todas as fases do roadmap (0 a 8) estão implementadas.** O próximo trabalho depende das decisões listadas em `docs/27-RELATORIO-FASE-8.md` §7 (jurídico, provedores, backup, MFA). Não implemente funcionalidades da lista "Itens futuros sem fase autorizada" do roadmap sem autorização registrada.

## 3. Arquitetura (resumo operacional)

- **Monorepo npm:** `apps/api` (NestJS), `apps/web` (Next.js 16 App Router), `packages/*`, `prisma/`.
- **API**, módulos em `apps/api/src/modules/<mod>/` com `domain/` (regras puras e testes `*.spec.ts`), `application/` (serviços com Prisma, transação e auditoria) e `http/` (controllers e DTOs) (`DT-023`).
- **Infraestrutura comum** em `apps/api/src/common/`:
  - `prisma`, `audit`, `config`;
  - `crypto`: scrypt, JWT, AES-GCM;
  - `domain`: `money.ts` (Decimal), `civil-date.ts`, `time-zone.ts`, `state-machine.ts`;
  - `http`: Problem Details, paginação, `IdempotencyKey`, `request-context`;
  - `storage` e `mail`: adaptadores locais;
  - `util/defined.ts`.
- **Autorização:**
  - guard global nega por padrão;
  - `@Public()` libera a rota;
  - `@RequirePermissions(PERMISSIONS.x)` exige permissão;
  - `@CurrentPrincipal()` e `@OptionalPrincipal()` injetam o usuário;
  - catálogo em `modules/access/domain/permission-catalog.ts`, sincronizado por `npm run db:seed`;
  - o catálogo já contém as permissões das fases 6 a 8: `partners.manage`, `partner.documents.read`, `services.manage`, `appointments.manage`, `settlements.manage`, `forum.publish`, `forum.moderate`, `news.manage`, `events.manage`, `notifications.send`, `reports.read`, `reports.export`, `privacy.requests.manage`.
- **Financeiro:** sempre use os serviços existentes.
  - `LedgerService.post`: todo lançamento passa por ele;
  - `PaymentsService.createInTx`, `confirmInTx` e `reverseInTx`;
  - `lockRow(tx, 'tabela', id)`: trava de linha (adicione a tabela em `LOCKABLE_TABLES` se precisar);
  - categorias de sistema em `finance/domain/finance-catalog.ts`; `vendas-parceiros` e `repasses-parceiros` já existem para a Fase 6.
- **Loja e remessas:** `OrdersService` expõe `systemCancelInTx`, `markReadyInTx` e `markPickedUpInTx`. Ao confirmar pagamento, `OrderItem.partnerId` já é preenchido com o parceiro do produto.
- **Notificações:** `NotificationsService.notify({ userId, type, title, message, link, deduplicationKey })` é idempotente.
- **Arquivos:** `MediaService.store(file, { ...IMAGE_POLICY | DOCUMENT_POLICY, kind, classification }, userId, tx)`. Use `PUBLIC` para imagens públicas e `CONFIDENTIAL` para documentos e comprovantes.
- **Web:**
  - `lib/api-client.ts`: função `api()`, que chama `/api/v1` via proxy e renova o token sozinha;
  - `lib/use-resource.ts`, `lib/auth-context.tsx` (`can(...)`), `lib/cart-context.tsx`;
  - `components/ui.tsx`: `TextField`, `SelectField`, `TextArea`, `ConfirmDialog` (com motivo), `useSubmit`, `ErrorSummary`, `Pagination`, `PageHeader`;
  - `components/admin-shell.tsx`: os links das fases 6 e 7 já existem no menu (`/admin/parceiros`, `/servicos`, `/agendamentos`, `/repasses`, `/noticias`, `/eventos`, `/forum`, `/notificacoes`, `/relatorios`) e precisam virar páginas;
  - `components/site-header.tsx`: links públicos `/noticias`, `/eventos`, `/parceiros` e `/forum` ainda sem página.

## 4. Convenções obrigatórias (aprendidas na prática)

1. **TypeScript strict** com `exactOptionalPropertyTypes`: nunca passe `undefined` explícito em propriedade opcional. Use `defined(dto)` ou o padrão `...(x === undefined ? {} : { x })`.
2. **Dinheiro:** API recebe e devolve string com 2 casas (`moneyView`, `parseMoney`); nunca `Number`/float em cálculo ou comparação de dinheiro, use `money(a).lessThan(b)`.
3. **Datas:** instantes em UTC; datas civis `YYYY-MM-DD` via `civilToDate`/`dateToCivil`; filtros por dia usam `startOfDayInZone`/`endOfDayExclusive` (fuso `America/Rio_Branco`).
4. **Toda ação sensível** chama `audit.record({ actorUserId, action, entityType, entityId, reason, before, after, meta }, tx)`.
5. **Operações financeiras** exigem `@IdempotencyKey()`. A chave é prefixada por fluxo (`fee-payment:...`), e o mesmo autor que reenvia recebe o resultado original.
6. **SCSS Modules** precisam de `arquivo.module.scss.d.ts` tipado. Não use `eslint-disable @next/next/...`, porque o plugin do Next não está configurado e a diretiva vira erro. `<img>` simples é permitido.
7. **Next.js:**
   - arquivos `layout.tsx` não podem ter exports extras;
   - páginas públicas são Server Components usando `serverGet()` de `lib/server-api.ts`;
   - telas autenticadas são `'use client'`.
8. **Migrations:** `prisma migrate dev` falha em terminal não interativo. Use este fluxo:
   ```bash
   D=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_nome && mkdir -p $D
   npx dotenv -e .env -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > $D/migration.sql
   npx dotenv -e .env -- prisma migrate deploy && npx dotenv -e .env -- prisma generate
   ```
9. **Shell:** evite crases (template strings) dentro de `node -e "..."` no Bash, porque o shell as interpreta. Para editar documentos, escreva um `.js` temporário no scratchpad ou use a ferramenta de edição.
10. **Antes de commitar:** `npx prettier --write apps docs` e depois `npm run check` (formatação, lint, tipos, testes, Prisma, build) e `npm run test:integration`.
11. **Testes de integração** usam `apps/api/test/helpers.ts`: `createTestContext`, `createUser`, `login`, `tokenFor(ctx, ['board'])`, `uniqueEmail`, `PNG_1X1`. O rate limit é desligado (`THROTTLE_DISABLED`). Dados de teste ficam no mesmo banco local, então use nomes e e-mails aleatórios e não assuma tabelas vazias.
12. **Dependências:** o npm 11 bloqueia install scripts. O `sharp` funciona com binários pré-compilados. Ao adicionar dependência, rode `npm audit --audit-level=high` e, se houver aviso, use `overrides` no `package.json` raiz (ver `DT-019` e o CHANGELOG). Não use pacotes somente ESM na API (Jest em CommonJS); por isso o `jose` foi descartado.
13. **Commits** na branch `desenvolvimento`, mensagem em português no formato `feat: fase N — ...`, terminando com:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    ```

## 5. Plano executado nas fases 6 a 8 (histórico)

### Fase 6 — Parceiros e profissionais (RF-031 a RF-034, RCF-010, RCF-011)

O schema já existe: `Partner`, `PartnerDocument`, `PartnerProfessional`, `PartnerService`, `ProfessionalAvailability`, `Appointment`, `PartnerSettlement`, `PartnerSettlementItem`, além de `Product.partnerId`, campos de comissão e snapshots de comissão em `OrderItem`.

1. **Parceiros:** CRUD com estados `PENDING → ACTIVE → INACTIVE/ENDED`. Só `ACTIVE` dentro da vigência do contrato aparece publicamente e vende (RN-PAR-001; a loja já filtra `partner.status === 'ACTIVE'`). Documento cifrado com hash, como no atleta. Logo público; documentos `CONFIDENTIAL` exigem `partner.documents.read`.
2. **Comissão (PEN-035):** no checkout, gravar em `OrderItem` o snapshot da regra (`commissionTypeSnapshot`, taxa ou valor fixo, `partnerAmountSnapshot` = total − comissão). Hoje o checkout só preenche `partnerId`: complete isso em `orders.service.ts` no `orderItem.create`. Produto pode sobrepor a comissão do parceiro.
3. **Repasses:** `PartnerSettlement` agrupa itens de pedidos **pagos** e não repassados de um período. Estados `DRAFT → PENDING → APPROVED → PAID`. Ao pagar, lançar saída no Caixa com `LedgerService.post` (origem `PARTNER_SETTLEMENT`, categoria `repasses-parceiros`, `partnerSettlementId`). Relatório de vendas por parceiro separando receita do time e valor devido (RN-PAR-003).
4. **Profissionais e serviços:** profissional vinculado a parceiro aprovado; serviço com valor (Decimal) e duração; disponibilidade por intervalos, verificando sobreposição com bloqueio de linha.
5. **Agendamentos (PEN-037, modo manual recomendado):** usuário autenticado solicita (`REQUESTED`) em horário disponível; diretoria confirma ou cancela com motivo; estados `COMPLETED` e `NO_SHOW`; sem conflito de horário confirmado; notificação às partes. **Nenhum dado de saúde** (RN-PAR-008): só observação livre com aviso.
6. **Parceiro não tem login nesta fase** (`PEN-036`): a diretoria opera tudo.
7. **Web:**
   - público: `/parceiros` (aprovados) e serviços com botão "solicitar";
   - "Minha conta": `/minha-conta/agendamentos`;
   - painel: `/admin/parceiros`, `/admin/servicos`, `/admin/agendamentos`, `/admin/repasses`;
   - na ficha do produto, seletor de parceiro (o DTO já aceita `partnerId`).
8. **Testes:** `phase6-partners.int-spec.ts`, cobrindo publicação só de ativo, snapshot de comissão, repasse com saída única no Caixa e conflito de agenda.

### Fase 7 — Comunicação (RF-040 a RF-043, RCF-001, RCF-012, RCF-013)

Schema: `NewsCategory`, `News`, `Event`, `Match`, `ForumCategory`, `ForumTopic`, `ForumPost`, `ForumReaction`, `ForumReport`, `ForumModerationAction`, `Notification`.

- Notícias com rascunho, agendamento (`publishedAt` em UTC; exibir somente quando `publishedAt ≤ agora`), destaque, slug único, capa (`MediaService`), canais (página inicial e fórum) sem duplicar conteúdo (`DT-016`). Incluir os destaques em `app/(site)/home-highlights.tsx`.
- Eventos e partidas, públicos ou não, com vínculo opcional à notícia e à seletiva (`Tryout.eventId`). Páginas `/noticias`, `/noticias/[slug]` e `/eventos`.
- Fórum restrito a usuários verificados (`PEN-039`): visibilidades `PUBLIC`, `MEMBERS` e `STAFF`; tópicos, posts, reações idempotentes, denúncias; moderação com motivo (ocultar, restaurar, fechar, fixar) e histórico em `ForumModerationAction`; exclusão lógica; rate limit em postagem.
- `notifications.send`: aviso manual da diretoria a grupos (atletas ativos, equipe), idempotente.
- Sanitizar conteúdo: texto simples ou markdown restrito, nunca HTML cru.

### Fase 8 — Relatórios, auditoria e otimizações (RF-020, RF-021, RF-024, RF-045)

- `/admin/relatorios`: atletas por status e equipe, inscrições por seletiva, mensalidades (inadimplência por mês), Caixa (por período, conta, categoria, centro de custo, origem e comprovantes pendentes), vendas por produto e parceiro, remessas.
- Exportação CSV com permissão própria `reports.export` (leitura não implica exportação), com período e fuso no cabeçalho e auditoria de cada exportação.
- Auditoria com filtros avançados e tela de detalhe; solicitações de titular LGPD (`privacy.requests.manage`): exportar dados próprios e pedido de exclusão/anonimização.
- Revisão de acessibilidade (WCAG 2.2 AA), índices de banco onde houver consulta lenta, testes de carga básicos, runbook de backup/restauração em `docs/15`.
- Relatório final `docs/27-RELATORIO-FASE-8.md` e atualização de toda a documentação, como foi feito para as fases anteriores.

## 6. Pendências que continuam do responsável (não decidir sozinho)

Todas estão explicadas em `docs/28-DECISOES-PENDENTES-DO-RESPONSAVEL.md`. O responsável pediu para retomar esses pontos quando o sistema estiver sendo finalizado: **não pergunte sobre elas antes disso**. Já decidido em 2026-10-20: MFA obrigatório para administrador e diretoria (implementar antes da produção), backup diário entre 01h e 03h com RPO e RTO de 1 dia, e hospedagem adiada até a homologação.
