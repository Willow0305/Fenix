# Relatório de entrega — Fase 4

**Data da validação:** 18/10/2026  
**Estado:** implementada; validada por lint, testes (inclusive concorrência de estoque) e build  
**Escopo:** catálogo, variações, estoque, carrinho, favoritos, pedidos, pagamento e integração com o Caixa  
**Commit:** `0291d5c`

## 1. Resultado

A loja opera sem venda acima do estoque:

- o checkout trava as variações, revalida tudo no servidor e reserva estoque em uma única transação;
- o pagamento confirmado converte a reserva em saída e lança a venda no Caixa;
- o cancelamento após pagamento estorna com reembolso vinculado e pode devolver os itens ao estoque.

Visitantes compram sem conta e consultam o pedido com número mais código secreto.

## 2. Entregas

### Backend (`store`)

| Serviço | Capacidades |
|---|---|
| `CatalogService` | categorias, produtos, variações (SKU, tamanho, cor, preço), imagens públicas, publicação e arquivamento motivado |
| `InventoryService` | razão de movimentações, níveis disponível/reservado, entrada, perda e ajuste auditados |
| `CartService` / `FavoritesService` | carrinho no servidor (usuário ou visitante), mesclagem no login, favoritos privados |
| `OrdersService` | checkout, consulta (painel, cliente, visitante), comprovante PIX, pagamento, estados, cancelamento/reembolso, expiração de reservas, vendas do mês |

### Frontend

- loja pública com categorias, busca, página de produto, carrinho e checkout, consulta de pedido de visitante;
- "Minha conta": pedidos (com envio de comprovante) e favoritos;
- painel: produtos (variações, estoque, movimentações, imagens) e pedidos (comprovantes, confirmação, estados);
- destaques da loja na página inicial e indicador do carrinho no cabeçalho.

### Dados

Migration `fase4_loja_pedidos`: hash do código de acesso do visitante e expiração da reserva.

## 3. Requisitos atendidos

| Requisito | Situação |
|---|---|
| RF-015 produtos | atendido |
| RF-016 estoque | atendido; baixa única no pagamento confirmado, ajuste com motivo |
| RF-017/018 pedidos e estados | atendidos |
| RF-019 área do cliente | pedidos e favoritos |
| RF-020 vendas do mês | atendido |
| RF-029 entrada automática do pedido | atendido |
| RF-035 modo de venda | estoque, sob encomenda e remessa; digital indisponível |
| RF-037/038 carrinho e favoritos | atendidos |
| RCF-007/008 | atendidos (parceiros na Fase 6) |

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| `npm run check` | aprovado |
| testes de domínio | 7 casos: preço efetivo, estoque ao longo do ciclo, sinais de movimento, vendabilidade, totais, transições, número de pedido |
| testes de integração | 9 cenários: visibilidade pública, checkout de visitante com preço congelado e consulta por código, **três checkouts simultâneos pela última unidade com apenas um aceito**, confirmação idempotente, cancelamento pago com reembolso e reestoque, limite por comprador e expiração, ajuste auditado, favoritos e mesclagem, arquivamento |

## 5. Decisões principais

`DT-031` (estoque por razão, reserva, pedido e visitante).

## 6. Pontos em aberto e riscos

- política de devolução e reembolso da loja a publicar antes de vendas reais (`PEN-030`);
- frete e entrega fora do escopo atual: retirada combinada com o time (`PEN-028`).

## 7. Próximo passo

Fase 5 — remessas ([24-RELATORIO-FASE-5](./24-RELATORIO-FASE-5.md)).
