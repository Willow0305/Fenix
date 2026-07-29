# API REST

## 1. Situação atual

A API implementa a base técnica da Fase 1 e as primeiras entregas verticais das
Fases 2 e 3. Todos os recursos de negócio exigem autenticação, permissão atômica
no servidor e CSRF nas mutações autenticadas. O uso permanece restrito a
local/teste com dados fictícios.

| Método | Rota | Autenticação | Situação |
|---|---|---|---|
| `GET` | `/health` | não | implementada |
| `POST` | `/api/v1/auth/login` | não | implementada |
| `POST` | `/api/v1/auth/refresh` | refresh + CSRF | implementada |
| `POST` | `/api/v1/auth/logout` | sessão + CSRF | implementada |
| `GET` | `/api/v1/auth/me` | sessão | implementada |
| `POST` | `/api/v1/auth/password-recovery` | não | implementada; resposta não enumerável |
| `POST` | `/api/v1/auth/password-reset` | não | implementada; código de uso único |
| `POST` | `/api/v1/auth/email-verification/resend` e `/confirm` | público não enumerável / token | implementada; hash, frequência, 24 horas e uso único |
| `POST` | `/api/v1/auth/mfa/...` | sessão ou desafio | matrícula, confirmação, desafio e desativação implementados |
| `GET/POST/PATCH/PUT` | `/api/v1/users...` | sessão + permissão específica; CSRF em mutações | implementada no escopo mínimo |
| `GET/PUT` | `/api/v1/roles...`, `/api/v1/permissions` | sessão + permissão específica; CSRF em mutações | implementada |
| `GET` | `/api/v1/audit-logs` | `audit.read` | implementada |
| `GET/POST/PATCH` | `/api/v1/privacy...` | permissões de privacidade; CSRF em mutações | solicitações do titular e execução de retenção |
| `GET/POST/PATCH` | `/api/v1/sports...` | permissões `sports.*`; CSRF em mutações | equipes, categorias, atletas, responsáveis, seletivas e inscrições |
| `GET/POST` | `/api/v1/finance...` | permissões `finance.*`; CSRF e idempotência nas operações críticas | catálogos, planos, cobranças, pagamentos, razão, transferências, obrigações e caixa |

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

- cookies `fenix_access` e `fenix_refresh` são `HttpOnly`; o cliente não recebe
  tokens no corpo nem os persiste em `localStorage`;
- `X-CSRF-Token` deve repetir o cookie legível `fenix_csrf` em requisições
  mutáveis autenticadas e no refresh;
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

## 4. Autenticação e autorização implementadas na Fase 1

Fluxo vigente em ambiente local/teste:

1. login valida credenciais e o estado do usuário;
2. API cria sessão revogável, entrega access/refresh em cookies `HttpOnly` e
   vincula um token CSRF armazenado somente como hash no banco;
3. access token dura 45 minutos; refresh opaco é rotacionado e sua reutilização
   revoga as sessões ativas da conta;
4. inatividade expira a sessão; logout, bloqueio/inativação e troca de senha
   revogam sessões conforme o caso;
5. falhas consecutivas bloqueiam temporariamente login ou código de recuperação;
6. recuperação usa código numérico de uso único enviado por SMTP, com resposta
   não enumerável e sem persistir o código em claro;
7. cada rota administrativa exige permissões atômicas no servidor e acessos
   negados autenticados geram auditoria;
8. o frontend tenta um refresh seguro uma vez diante de `401` e encaminha para a
   tela de sessão expirada se a renovação falhar.

Os parâmetros canônicos implementados aceitam variáveis de ambiente e são
validados na inicialização: inatividade e access token de 45 minutos, duração
absoluta de 30 dias, recuperação por 10 minutos e cinco tentativas, cinco falhas
de login em 15 minutos, bloqueio inicial de 15 minutos e verificação de e-mail
por 24 horas. Refresh é opaco, rotativo e de uso único; CSRF é vinculado à
sessão. MFA TOTP é obrigatório para papéis privilegiados e opcional para
`USER`. Rate limit usa Redis em ambiente compartilhado. Cookies usam `Secure` em
produção e CORS exige lista explícita, nunca `*` com credenciais.

## 5. Catálogo por estado

As rotas abaixo são agrupamentos de contrato. Nomes finais serão confirmados na fase correspondente.

| Grupo | Prefixo proposto | Capacidades | Fase |
|---|---|---|---:|
| autenticação | `/api/v1/auth` | login, refresh, logout, recuperação, verificação de e-mail e MFA implementados | 1 |
| usuários | `/api/v1/users` | lista, criação de conta comum, nome, estado, papéis e revogação de sessões implementados | 1 |
| RBAC | `/api/v1/roles`, `/api/v1/permissions` | catálogo e associação implementados; papel ADMIN é protegido | 1 |
| privacidade | `/api/v1/privacy` | solicitações do titular e retenção implementadas; operação jurídica depende de governança | 1 |
| esportivo | `/api/v1/sports` | equipes, categorias, atletas, histórico, responsáveis, seletivas, inscrições e conversão implementados | 2 |
| importação esportiva | — | somente metadados físicos; processamento permanece futuro | 2 |
| mensalidades automáticas | — | não implementadas | 3 |
| Caixa Fênix | `/api/v1/finance` | contas, categorias, centros, planos/versionamento, cobranças, pagamentos/conciliação, razão, transferências, obrigações e fechamento implementados | 3 |
| arquivos privados | — | somente metadados físicos; upload/objeto real bloqueado | 1–3 |
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
| auditoria-base | `/api/v1/audit-logs` | consulta restrita da trilha administrativa da Fase 1 implementada; relatórios avançados permanecem na Fase 8 | 1/8 |

Rotas públicas devem ser separadas por política de acesso, não por confiança no cliente. Cadastros públicos recebem rate limiting, proteção contra automação e coleta mínima.

## 6. Operações financeiras

Requisitos aplicados ao contrato implementado:

- valores nunca são `number` binário no contrato;
- recurso confirmado não é apagado;
- estorno e reembolso referenciam a origem;
- transferência tem identificador comum para as duas pernas;
- alteração exige motivo quando sensível;
- confirmação usa transação no banco e chave de idempotência;
- não existe webhook nem gateway real nesta entrega;
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
- o smoke valida Swagger e OpenAPI em HTTP 200 fora de produção;
- um teste garante que Swagger/OpenAPI respondem `404` em `production`;
- DTOs, validação estrita e tipos locais mantêm o contrato usado pelo frontend;
- lint dedicado de OpenAPI e geração automática de cliente permanecem futuros.

## 9. Itens a confirmar

| Item | Pendência |
|---|---|
| URL pública, domínios e CORS | local/teste definido; staging e produção permanecem em `PEN-043` |
| Paginação por cursor/offset, concorrência otimista, formatos e geração de grandes exportações | `PEN-049` |
| Limites globais, por ator e por endpoint, capacidade e metas de desempenho | `PEN-050` |
| Domínio, `SameSite` e topologia final dos cookies | `PEN-043` |
| Governança de dados reais, menores e retenção jurídica | `PEN-010`, `PEN-011` |
| Plano de contas, reabertura, limites monetários e operação financeira real | `PEN-020`, `PEN-022`–`PEN-025` |
| Contrato de acesso de parceiros | `PEN-036` |

As decisões e seus aprovadores devem ser registrados em [`PENDENCIAS.md`](../PENDENCIAS.md) antes de estabilizar cada contrato afetado.
