# API REST

## 1. Situação atual

Na Fase 0, a API contém somente infraestrutura e um endpoint técnico de saúde. Todos os demais recursos deste documento são **planejados**, não implementados.

| Método | Rota | Autenticação | Situação |
|---|---|---|---|
| `GET` | `/health` | não | esqueleto técnico da Fase 0 |
| qualquer outra | `/api/v1/...` | conforme recurso | contrato futuro |

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
| inscrições | `/api/v1/registrations` | fluxo geral e conversão controlada | 2 |
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
