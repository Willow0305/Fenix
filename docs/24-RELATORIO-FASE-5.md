# Relatório de entrega — Fase 5

**Data da validação:** 19/10/2026  
**Estado:** implementada; validada por lint, testes e build  
**Escopo:** remessas (pré-vendas por período), consolidação para fornecedor, produção, chegada e retirada  
**Commit:** `93c6d87`

## 1. Resultado

Uniformes e produtos sob encomenda são vendidos por período e encomendados à malharia somente após atingir o mínimo de unidades pagas. O relatório consolidado reflete apenas pedidos pagos. A chegada avisa, uma única vez, apenas os compradores afetados, e cada retirada fica registrada. Cancelar uma remessa estorna todos os pedidos sem apagar o histórico financeiro.

## 2. Entregas

### Backend (`campaigns`)

- remessas com janela de venda, mínimo e máximo, produtos com preço e limites próprios;
- máquina de estados com reabertura para extensão de prazo e configuração imutável após a encomenda;
- encerramento automático por prazo (rotina interna e endpoint);
- relatório consolidado e CSV para a malharia e para a lista de retirada;
- notificação de chegada (in-app e e-mail) e registro de retirada;
- integração com pedidos: separação de pedidos de remessa, cancelamento sistêmico com reembolso, marcação de pronto e entregue.

### Frontend

- painel: lista e detalhe da remessa (produtos, etapas, consolidado, downloads e registro de retirada);
- loja: destaque das pré-vendas abertas com prazo e política exibidos antes da compra.

### Operação

`npm run db:demo` cria dados fictícios de demonstração (equipes, atletas, plano, seletiva, produtos, remessa).

## 3. Requisitos atendidos

| Requisito | Situação |
|---|---|
| RF-035 produto de remessa | atendido |
| RF-036 controle de remessa | atendido (abertura, encerramento, fornecedor, previsão, recebimento, retirada) |
| RF-044 aviso de chegada | atendido, idempotente e restrito aos compradores |
| RCF-009 mínimos, consolidação, cancelamento e reembolso | atendido |

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| `npm run check` | aprovado (65 testes unitários de API, 7 web) |
| testes de domínio | 5 casos: transições, edição bloqueada, janela, mínimo, consolidação e CSV |
| testes de integração | 6 cenários: venda só aberta e até o máximo, separação de pedidos, mínimo pago e extensão de prazo, consolidado/CSV, aviso único e retirada, cancelamento com estornos, permissões |
| suíte completa de integração | 55 cenários (fases 1 a 5) aprovados |

## 5. Decisões principais

`DT-032` (remessas).

## 6. Pontos em aberto e riscos

- texto da política de reembolso por remessa precisa ser aprovado e publicado (`PEN-032`);
- vínculo com fornecedor-parceiro ganha cadastro completo na Fase 6.

## 7. Próximo passo

Fase 6 — parceiros e profissionais.
