# Relatório de entrega — Fase 3

**Data da validação:** 18/10/2026  
**Estado:** implementada; validada por lint, testes (inclusive concorrência) e build  
**Escopo:** planos e mensalidades, pagamentos, Caixa Fênix, contas a pagar/receber, conciliação e fechamento  
**Commit:** `9563b67`

## 1. Resultado

O controle financeiro segue as regras permanentes do projeto:

- dinheiro sempre em `Decimal`;
- saldo derivado dos lançamentos;
- confirmado nunca apagado nem reescrito;
- estornos e reembolsos vinculados ao original;
- períodos fechados bloqueados.

Pagamento confirmado gera exatamente uma entrada no Caixa, na mesma transação. Operações financeiras exigem `Idempotency-Key`, e concorrência na mesma linha é serializada.

## 2. Entregas

### Backend (`finance`)

| Serviço | Capacidades |
|---|---|
| `FeesService` | planos, vínculo atleta–plano com valor individual, geração mensal idempotente, pagamentos parciais, confirmação, estorno, desconto/isenção, cancelamento, comprovante PIX do atleta |
| `PaymentsService` | criação, confirmação com lançamento único, cancelamento e reembolso vinculado |
| `LedgerService` | lançamentos manuais, confirmação, cancelamento de pendentes, estorno, conciliação, comprovantes, transferências de duas pernas, saldo inicial, saldos derivados |
| `ObligationsService` | contas a pagar e a receber, quitação com lançamento, cancelamento |
| `ClosingsService` | prévia do saldo esperado, fechamento por conta e período, reabertura motivada |
| `FinanceReportsService` | resumo por período, conta, categoria e origem; pendências; contas e mensalidades em aberto |

### Frontend

- painel: mensalidades (geração, filtros, detalhe com pagamentos), planos, Caixa (resumo, lançamentos, transferência, comprovantes), pagar e receber, fechamentos, cadastros (contas, saldo inicial, categorias, centros de custo, formas de pagamento);
- plano de mensalidade na ficha do atleta;
- "Minha conta": mensalidades, chave PIX e envio de comprovante.

### Dados

Plano de contas provisório semeado por código (categorias de sistema protegidas), contas e formas de pagamento padrão.

## 3. Requisitos atendidos

| Requisito | Situação |
|---|---|
| RF-011 a RF-014 mensalidades | atendidos |
| RF-025 Caixa Fênix | atendido; saldos derivados, sem saldo editável |
| RF-026/027 lançamentos e categorias | atendidos |
| RF-028 comprovantes | atendido; arquivo fora do banco, classificado como confidencial |
| RF-029 entrada automática | atendido para mensalidades (pedidos na Fase 4) |
| RF-030 conciliação e fechamento | atendido |
| RF-045 relatórios do Caixa | resumo inicial (exportações na Fase 8) |
| RCF-002 a RCF-006 | atendidos |

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| `npm run check` | aprovado |
| testes de domínio | 14 casos: dinheiro sem ponto flutuante, arredondamento, vencimento, status, saldo, períodos fechados, fusos com e sem horário de verão |
| testes de integração | 13 cenários: geração idempotente, parcial e quitação, excesso, idempotência por chave e autor, **três pagamentos simultâneos com apenas um aceito**, estorno vinculado, comprovante do atleta, ajustes, estorno único, natureza de categoria, transferência, fechamento/reabertura com permissão própria, quitação de obrigação, privacidade de comprovantes |

## 5. Decisões principais

`DT-027` (mensalidades sem encargos automáticos, com parcial) e `DT-030` (livro-caixa, pagamentos e fechamento).

## 6. Pontos em aberto e riscos

- validação contábil do plano de contas (`PEN-020`);
- recorrência e parcelamento de contas a pagar (`PEN-025`);
- gateway e PIX automático fora do escopo atual (`PEN-026`).

## 7. Próximo passo

Fase 4 — loja ([23-RELATORIO-FASE-4](./23-RELATORIO-FASE-4.md)).
