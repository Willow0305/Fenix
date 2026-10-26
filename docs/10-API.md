# API REST

## 1. Situação atual

O contrato completo e executável fica no OpenAPI (`/docs` fora de produção). Endpoints implementados:

| Método | Rota | Acesso | Fase |
|---|---|---|---|
| `GET` | `/health` | público | 0 |
| `POST` | `/api/v1/auth/register` · `login` · `refresh` · `logout` | público (refresh/logout por cookie) | 1 |
| `POST` | `/api/v1/auth/password/forgot` · `password/reset` | público, com rate limiting | 1 |
| `GET`/`PATCH` | `/api/v1/me` | autenticado (próprio) | 1 |
| `POST` | `/api/v1/me/password` | autenticado | 1 |
| `GET`/`DELETE` | `/api/v1/me/sessions[/:id]` | autenticado | 1 |
| `GET`/`POST` | `/api/v1/users` | `users.read` / `users.create`+`roles.assign` | 1 |
| `PUT` | `/api/v1/users/:id/roles` · `:id/status` | `roles.assign` / `users.update` | 1 |
| `POST` | `/api/v1/users/:id/sessions/revoke` | `sessions.revoke` | 1 |
| `GET` | `/api/v1/roles` · `/api/v1/permissions` | `users.read` | 1 |
| `PUT` | `/api/v1/roles/:code/permissions` | `permissions.manage` | 1 |
| `GET` | `/api/v1/audit-logs` | `audit.read` | 1 |
| `GET` | `/api/v1/public/team` | público | 1 |
| `GET` | `/api/v1/team-settings` · `PATCH` | `dashboard.read` · `settings.public.manage` | 1 |
| `PUT` | `/api/v1/team-settings/financial` | `settings.financial.manage` | 1 |
| `GET` | `/api/v1/team-settings/payment-info` | autenticado | 1 |
| `PUT` | `/api/v1/team-settings/brand-assets/:context` | `logos.manage` (multipart) | 1 |
| `GET` | `/api/v1/media/:id` | público se `PUBLIC`; senão autorizado | 1 |
| `GET` | `/api/v1/public/teams[/:slug]` · `public/categories` · `public/tryouts[/:slug]` | público | 2 |
| `POST` | `/api/v1/public/tryouts/:slug/registrations` · `public/interest` | público, rate limiting | 2 |
| `GET`/`POST`/`PATCH` | `/api/v1/teams` · `/api/v1/sport-categories` | `athletes.read` / `teams.manage` | 2 |
| `GET`/`POST`/`PATCH` | `/api/v1/athletes[/:id]` | `athletes.read` / `athletes.create` / `athletes.update` | 2 |
| `PUT` | `/api/v1/athletes/:id/status` | `athletes.status.change` | 2 |
| `PUT`/`POST` | `/api/v1/athletes/:id/user` · `:id/user/unlink` | `athletes.update` | 2 |
| `POST` | `/api/v1/athletes/:id/memberships` · `memberships/:mid/end` | `teams.assign` | 2 |
| `GET`/`PUT`/`POST` | `/api/v1/interested-people` · `:id/status` · `:id/convert` | `registrations.read` / `registrations.review` | 2 |
| `GET`/`POST`/`PATCH`/`PUT` | `/api/v1/tryouts[/:id]` · `:id/status` · `:id/registrations` | `registrations.read` / `tryouts.manage` | 2 |
| `PUT`/`POST` | `/api/v1/tryout-registrations/:id/status` · `:id/convert` | `registrations.review` | 2 |
| `GET` | `/api/v1/me/athlete` · `me/tryout-registrations` | próprio | 2 |
| `GET`/`POST` | `/api/v1/me/notifications` · `unread-count` · `read-all` · `:id/read` | próprio | 2 |
| `GET`/`PUT` | `/api/v1/me/notifications/preferences` · `PUT` `whatsapp-consent` | próprio (`DT-048`) | 7 |
| `GET` | `/api/v1/notifications/deliveries/summary` | `notifications.send` (`DT-048`) | 7 |
| `GET` | `/api/v1/me/events` (Server-Sent Events, não conta como uso da sessão) | autenticado (`DT-049`) | 7 |
| `GET`/`DELETE` | `/api/v1/auth/trusted-devices[/:id]`; `POST /auth/mfa/verify` aceita `rememberDevice` | autenticado (`DT-050`) | 7 |
| `PUT` / `PATCH` | `/api/v1/store/products/:id/images/order` · `images/:imageId` | `products.manage` (`DT-051`) | 4 |
| `POST` | `/api/v1/cart/items/change` | público, rate limiting (`DT-051`) | 4 |
| `GET` | `/api/v1/public/live?topics=store,tryouts` (Server-Sent Events) | público, até 6 por IP (`DT-051`) | 4 |
| `GET` | `/api/v1/search?q=` | `dashboard.read`; grupos por permissão (`DT-057`) | 9 |
| `GET` | `/api/v1/finance/trend?months=` | `finance.read`; mensalidades com `fees.read` (`DT-058`) | 9 |
| `GET` | `/api/v1/dashboard/summary` | `dashboard.read` | 2 |
| `GET`/`POST`/`PATCH` | `/api/v1/fee-plans` · `athletes/:id/fee-plans` · `:id/fee-plans/:link/end` | `fees.read` / `fees.plans.manage` | 3 |
| `POST` | `/api/v1/monthly-fees/generate` | `fees.generate` | 3 |
| `GET` | `/api/v1/monthly-fees[/:id]` | `fees.read` | 3 |
| `POST` | `/api/v1/monthly-fees/:id/payments` (Idempotency-Key) · `payments/:pid/confirm` · `payments/:pid/reverse` | `payments.record` / `payments.confirm` / `payments.correct` | 3 |
| `POST` | `/api/v1/monthly-fees/:id/adjust` · `:id/cancel` | `fees.adjust` | 3 |
| `GET`/`POST` | `/api/v1/me/monthly-fees[/:id]` · `:id/proof` (multipart, Idempotency-Key) | próprio | 3 |
| `GET` | `/api/v1/payments/:pid/attachments/:aid` | pagador ou `fees.read` | 3 |
| `GET`/`POST`/`PATCH` | `/api/v1/finance/accounts` · `categories` · `cost-centers` · `payment-methods` | `finance.read` / `finance.setup` | 3 |
| `POST` | `/api/v1/finance/accounts/:id/opening-balance` (Idempotency-Key) | `finance.setup` + `transactions.confirm` | 3 |
| `GET` | `/api/v1/finance/summary` · `transactions[/:id]` | `finance.read` | 3 |
| `POST` | `/api/v1/finance/transactions` (Idempotency-Key) · `:id/confirm` · `:id/cancel` · `:id/reverse` · `:id/reconcile` · `:id/attachments` | `transactions.*` / `cash.reconcile` | 3 |
| `POST` | `/api/v1/finance/transfers` (Idempotency-Key) | `transactions.create` + `transactions.confirm` | 3 |
| `GET`/`POST` | `/api/v1/finance/obligations` · `:id/settle` · `:id/cancel` | `finance.read` / `transactions.*` | 3 |
| `GET`/`POST` | `/api/v1/finance/closings` · `closings/preview` · `:id/reopen` | `finance.read` / `cash.reconcile` / `cash.close` / `cash.reopen` | 3 |
| `GET` | `/api/v1/public/product-categories` · `public/products[/:slug]` | público | 4 |
| `GET`/`PUT` | `/api/v1/cart` · `cart/items` | público (cookie de visitante ou conta) | 4 |
| `POST` | `/api/v1/orders/checkout` | público, rate limiting | 4 |
| `POST` | `/api/v1/public/orders/lookup` · `public/orders/proof` (Idempotency-Key) | número + código | 4 |
| `GET`/`POST` | `/api/v1/me/orders[/:id]` · `:id/proof` | próprio | 4 |
| `GET`/`PUT`/`DELETE` | `/api/v1/me/favorites[/:productId]` | próprio | 4 |
| `GET`/`POST`/`PATCH`/`PUT`/`DELETE` | `/api/v1/store/categories` · `store/products` · `:id/status` · `:id/variants` · `:id/images` | `products.manage` | 4 |
| `POST`/`GET` | `/api/v1/store/variants/:id/stock` · `:id/movements` | `inventory.adjust` / `products.manage` | 4 |
| `GET` | `/api/v1/store/orders[/:id]` | `orders.read` | 4 |
| `POST`/`PUT` | `/api/v1/store/orders/:id/payments` (Idempotency-Key) · `payments/:pid/confirm` · `:id/status` · `expire-reservations` | `orders.status.change` / `payments.*` | 4 |
| `GET` | `/api/v1/public/campaigns[/:slug]` | público | 5 |
| `GET`/`POST`/`PATCH` | `/api/v1/campaigns[/:id]` | `campaigns.manage` | 5 |
| `PUT` | `/api/v1/campaigns/:id/products` · `:id/status` | `campaigns.manage` (cancelar exige `payments.correct`) | 5 |
| `GET` | `/api/v1/campaigns/:id/report` · `report.csv?kind=supplier\|pickup` | `campaigns.manage` | 5 |
| `POST` | `/api/v1/campaigns/:id/orders/:orderId/pickup` · `campaigns/close-expired` | `campaigns.manage` | 5 |
| `GET` | `/api/v1/public/partners[/:id]` · `public/partner-services/:id/slots` | público (só parceiro operacional) | 6 |
| `POST` | `/api/v1/appointments` | autenticado, rate limiting | 6 |
| `GET`/`POST` | `/api/v1/me/appointments` · `:id/cancel` | próprio | 6 |
| `GET`/`POST`/`PATCH`/`PUT` | `/api/v1/partners[/:id]` · `:id/status` · `:id/logo` (multipart) | `partners.manage` | 6 |
| `POST`/`DELETE`/`GET` | `/api/v1/partners/:id/documents[/:docId]` · `:docId/file` | `partners.manage` + `partner.documents.read` / `partner.documents.read` | 6 |
| `GET`/`POST`/`PATCH` | `/api/v1/professionals[/:id]` · `partners/:id/professionals` | `services.manage` | 6 |
| `GET`/`POST`/`PATCH`/`PUT` | `/api/v1/partner-services[/:id]` · `:id/status` · `partners/:id/services` | `services.manage` | 6 |
| `GET`/`POST` | `/api/v1/professionals/:id/availability` · `availability/:id/block` | `services.manage` | 6 |
| `GET`/`PUT` | `/api/v1/appointments[/:id]` · `:id/status` | `appointments.manage` | 6 |
| `GET`/`POST`/`PUT` | `/api/v1/settlements[/:id]` · `partners/:id/settlements` (Idempotency-Key) · `:id/status` | `settlements.manage` | 6 |
| `POST` | `/api/v1/settlements/:id/pay` (Idempotency-Key) | `settlements.manage` + `transactions.confirm` | 6 |
| `GET` | `/api/v1/partners/sales-report?from&to&partnerId` | `settlements.manage` | 6 |
| `GET` | `/api/v1/public/news[/:slug]?channel=home\|forum&category` · `public/news-categories` | público (somente publicadas) | 7 |
| `GET`/`POST`/`PATCH` | `/api/v1/news[/:id]` · `news-categories[/:id]` | `news.manage` | 7 |
| `POST`/`PUT` | `/api/v1/news/:id/publish` (agora ou `scheduledAt`) · `:id/status` · `:id/cover` (multipart) | `news.manage` | 7 |
| `GET` | `/api/v1/public/events[/:slug]?scope=upcoming\|past` | público | 7 |
| `GET`/`POST`/`PATCH`/`PUT` | `/api/v1/events[/:id]` · `:id/status` | `events.manage` | 7 |
| `GET` | `/api/v1/forum/categories` · `categories/:slug/topics` · `topics/:id` | público conforme visibilidade | 7 |
| `POST`/`PATCH`/`DELETE`/`PUT` | `/api/v1/forum/categories/:slug/topics` · `topics/:id/posts` · `posts/:id` · `posts/:id/reaction` · `forum/reports` | autenticado, limites antiabuso | 7 |
| `GET`/`POST`/`PATCH`/`PUT` | `/api/v1/forum/admin/categories[/:id]` · `topics/:id/moderation` · `posts/:id/moderation` · `forum/reports[/:id]` · `forum/moderation-actions` | `forum.moderate` | 7 |
| `POST`/`GET` | `/api/v1/notifications/broadcast` (Idempotency-Key) · `notifications/broadcasts` | `notifications.send` | 7 |
| `GET` | `/api/v1/reports` · `reports/:key?from&to&groupBy` | `reports.read` | 8 |
| `GET` | `/api/v1/reports/:key/csv` | `reports.read` + `reports.export` (auditado) | 8 |
| `GET` | `/api/v1/audit-logs?action&entityType&entityId&actorUserId&requestId&from&to` · `audit-logs/entity-types` · `audit-logs/:id` | `audit.read` | 8 |
| `GET`/`POST` | `/api/v1/me/privacy/export` · `me/privacy/requests` | próprio, rate limiting | 8 |
| `GET`/`PUT`/`POST` | `/api/v1/privacy-requests` · `:id` · `:id/anonymize` | `privacy.requests.manage` (anonimizar também `users.update`) | 8 |

Listas usam `page`/`pageSize` (máx. 100) e retornam `{ data, meta }` (`DT-025`).

Em ambientes com `NODE_ENV` diferente de `production`, a interface Swagger fica em `/docs` e o documento JSON em `/docs/openapi.json`. Em `production`, as duas rotas respondem `404`; nenhuma delas integra o prefixo funcional `/api/v1`.

## 2. Convenções de contrato

### 2.1 Base e versionamento

- prefixo funcional: `/api/v1`;
- versão muda apenas diante de quebra incompatível;
- mudanças aditivas preservam a versão;
- OpenAPI é publicado somente fora de `production`, em `/docs` e `/docs/openapi.json`; ambas as rotas respondem `404` em produção.

### 2.2 Representações

| Conceito | Representação |
|---|---|
| identificador | UUID em string |
| instante | ISO 8601 em UTC, por exemplo `2026-07-23T18:00:00Z` |
| data civil | `YYYY-MM-DD` |
| dinheiro | string decimal e código de moeda, por exemplo `{ "amount": "89.90", "currency": "BRL" }` |
| booleano | `true` ou `false` |
| enum | string estável documentada no OpenAPI |
| ausência | campo omitido quando não aplicável; `null` somente quando fizer parte do contrato |

O JSON usa `camelCase`. Contratos não expõem nomes de colunas ou tipos internos do Prisma.

### 2.3 Cabeçalhos

- `Authorization: Bearer <access-token>` para operações autenticadas;
- `Content-Type: application/json`;
- `X-Request-Id` aceito e devolvido quando válido, ou gerado pelo servidor;
- `Idempotency-Key` obrigatório em confirmações de pagamento, reembolso, transferências, fechamento e webhooks futuros;
- `If-Match` poderá proteger alterações concorrentes de recursos administrativos; a estratégia final depende de `PEN-049` e da fase do recurso.

### 2.4 Paginação, filtros e ordenação

Listas sempre terão limite máximo. Paginação por cursor é a forma de referência proposta, ainda sujeita à decisão de `PEN-049`:

```json
{
  "data": [],
  "pageInfo": {
    "nextCursor": null,
    "hasNextPage": false
  }
}
```

Filtros permitidos e campos ordenáveis são listas fechadas por endpoint. Texto de busca, datas e status devem ser validados. Não é permitido repassar fragmentos de ordenação à consulta.

## 3. Respostas e erros

### 3.1 Sucesso

- `200 OK`: leitura ou alteração com corpo;
- `201 Created`: criação, com `Location` quando aplicável;
- `202 Accepted`: processamento assíncrono futuro;
- `204 No Content`: ação concluída sem representação;
- `304 Not Modified`: cache condicional em conteúdo público, quando implementado.

### 3.2 Problem Details

Erros seguem `application/problem+json`:

```json
{
  "type": "https://fenix.example/problems/validation-error",
  "title": "Dados inválidos",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "Revise os campos informados.",
  "instance": "/api/v1/tryouts/registrations",
  "requestId": "7f55d01c-0eb2-4f12-bc20-f3f2d8a6f721",
  "errors": [
    {
      "field": "birthDate",
      "code": "INVALID_DATE",
      "message": "Informe uma data válida."
    }
  ]
}
```

Mensagens não revelam existência de conta, hash, token, query, stack trace nem dados de outro titular.

| Status | Uso |
|---:|---|
| 400 | sintaxe ou parâmetro malformado |
| 401 | credencial ausente, inválida ou expirada |
| 403 | identidade válida sem permissão |
| 404 | recurso inexistente ou ocultado por segurança |
| 409 | conflito de estado, unicidade ou idempotência |
| 413 | arquivo maior que o permitido |
| 415 | mídia não suportada |
| 422 | validação semântica |
| 429 | limite de requisições excedido |
| 500 | falha interna sem detalhes sensíveis |
| 503 | dependência crítica indisponível |

## 4. Autenticação e autorização planejadas

Fluxo de referência:

1. login valida credenciais e o estado do usuário;
2. API emite access token de curta duração;
3. refresh token opaco ou JWT identificável é rotacionado, armazenado somente como hash no servidor e entregue em cookie `HttpOnly`, `Secure` e com política `SameSite` adequada à topologia;
4. logout e troca de senha revogam a sessão pertinente;
5. recuperação de senha usa token de uso único e resposta que não enumera usuários;
6. cada endpoint exige permissões específicas; papéis são agrupadores, não atalhos no código.

A topologia de domínios, a duração dos tokens e a proteção CSRF serão fechadas antes da implementação.

## 5. Catálogo planejado

As rotas abaixo são agrupamentos de contrato. Nomes finais serão confirmados na fase correspondente.

| Grupo | Prefixo proposto | Capacidades | Fase |
|---|---|---|---:|
| autenticação | `/api/v1/auth` | login, refresh, logout e recuperação; verificação de e-mail somente se `RCF-015`, `PEN-008` e `PEN-013` forem aprovadas | 1; verificação condicional |
| usuários | `/api/v1/users` | perfil, estado, sessões e administração | 1 |
| RBAC | `/api/v1/roles`, `/api/v1/permissions` | papéis, permissões e associações | 1 |
| configurações | `/api/v1/team-settings` | identidade, contatos, políticas e mídia | 1 |
| atletas | `/api/v1/athletes` | cadastro, histórico e documentos | 2 |
| equipes/categorias | `/api/v1/teams`, `/api/v1/sport-categories` | estrutura esportiva e vínculos | 2 |
| interessados | `/api/v1/interested-people` | manifestações de interesse | 2 |
| seletivas | `/api/v1/tryouts` | agenda, publicação e inscrições | 2 |
| inscrições | `/api/v1/interested-people`, `/api/v1/tryout-registrations` | fluxo geral pelo interessado e conversão controlada (`DT-028`, `DT-046`) | 2 |
| mensalidades | `/api/v1/monthly-fees` | planos, cobranças, baixas e inadimplência | 3 |
| Caixa Fênix | `/api/v1/finance` | contas, categorias, centros, movimentos e fechamentos | 3 |
| arquivos | `/api/v1/media-files` | intenção de upload, metadados e acesso autorizado | 3 |
| catálogo | `/api/v1/products` | categorias, produtos, imagens e variações | 4 |
| estoque | `/api/v1/inventory` | movimentos, reservas, ajustes e posição | 4 |
| carrinho/favoritos | `/api/v1/cart`, `/api/v1/favorites` | experiência da loja | 4 |
| pedidos/pagamentos | `/api/v1/orders`, `/api/v1/payments` | pedido, cobrança, confirmação e reembolso | 4 |
| campanhas | `/api/v1/sales-campaigns` | janela, consolidação, produção e retirada | 5 |
| parceiros | `/api/v1/partners` | cadastro, contrato, comissão e repasse | 6 |
| profissionais | `/api/v1/professionals`, `/api/v1/services` | oferta e disponibilidade | 6 |
| agendamentos | `/api/v1/appointments` | solicitação, confirmação e cancelamento | 6 |
| notícias | `/api/v1/news` | rascunho, agendamento e publicação | 7 |
| eventos/partidas | `/api/v1/events`, `/api/v1/matches` | calendário e relações editoriais | 7 |
| fórum | `/api/v1/forum` | categorias, tópicos, posts, reações e denúncias | 7 |
| notificações | `/api/v1/notifications` | caixa de entrada e preferências | 7 |
| relatórios | `/api/v1/reports` | consultas autorizadas e exportações | 8 |
| auditoria | `/api/v1/audit-logs` | consulta restrita de trilha | 8 |

Rotas públicas devem ser separadas por política de acesso, não por confiança no cliente. Cadastros públicos recebem rate limiting, proteção contra automação e coleta mínima.

## 6. Operações financeiras

Requisitos obrigatórios para o contrato futuro:

- valores nunca são `number` binário no contrato;
- recurso confirmado não é apagado;
- estorno e reembolso referenciam a origem;
- transferência tem identificador comum para as duas pernas;
- alteração exige motivo quando sensível;
- confirmação usa transação no banco e chave de idempotência;
- webhooks são autenticados, toleram repetição e registram o evento externo sem incluir segredo;
- respostas indicam estado, origem, competência, vencimento e pagamento sem confundir esses conceitos;
- relatórios derivam de movimentos, não de um saldo digitado.

## 7. Uploads

Fluxo previsto:

1. cliente solicita uma intenção de upload;
2. API valida usuário, finalidade, tamanho e tipos permitidos;
3. API emite URL assinada curta ou aceita streaming controlado;
4. cliente envia o arquivo ao armazenamento;
5. API confirma hash, tamanho, MIME real e metadados;
6. acesso posterior exige autorização e URL assinada curta.

O banco não armazena o binário. Limites, retenção, antivírus e provedor constam como pendências.

## 8. OpenAPI e testes de contrato

- DTOs possuem exemplos sem dados pessoais reais;
- cada operação documenta permissões, erros e idempotência;
- mudanças no OpenAPI são revisadas no pull request;
- lint da especificação e teste de contrato entrarão no CI quando surgirem endpoints funcionais;
- o cliente web deve ser gerado ou tipado a partir do contrato somente após estabilização da Fase 1.

## 9. Itens a confirmar

| Item | Pendência |
|---|---|
| URL pública, domínios e CORS | `PEN-043` |
| Paginação por cursor/offset, concorrência otimista, formatos e geração de grandes exportações | `PEN-049` |
| Limites globais, por ator e por endpoint, capacidade e metas de desempenho | `PEN-050` |
| Duração e topologia de access/refresh token | `PEN-013`, `PEN-043` |
| Contrato de acesso de parceiros | `PEN-036` |

As decisões e seus aprovadores devem ser registrados em [`PENDENCIAS.md`](../PENDENCIAS.md) antes de estabilizar cada contrato afetado.
