# Relatório de entrega — Fase 6

**Data da validação:** 19/10/2026  
**Estado:** implementada; validada por lint, testes e build  
**Escopo:** parceiros, comissões, repasses, profissionais, serviços, disponibilidade e agendamento

## 1. Resultado

Parceiros passam por curadoria: só aparecem no site e vendem na loja quando aprovados e dentro da vigência do contrato. Cada item vendido guarda a regra de comissão aplicada, o que separa a receita do time do valor devido ao parceiro. Repasses agrupam vendas pagas, passam por aprovação e, ao serem pagos, geram uma única saída no Caixa. Profissionais oferecem serviços com horários livres; o usuário solicita e a diretoria confirma ou cancela, sem conflito de horário e sem coleta de dados de saúde.

## 2. Entregas

### Backend (`partners`)

- parceiros: cadastro, aprovação com vigência, inativação e encerramento motivados, comissão, logo público, documento (CNPJ/CPF) cifrado com hash, documentos confidenciais com leitura auditada;
- integração com a loja: vigência conferida no catálogo, carrinho e checkout; snapshot de comissão no item; comissão própria por produto; pedido em repasse aberto não é estornado;
- repasses: criação idempotente por período, ajuste motivado, aprovação, pagamento com saída única no Caixa, cancelamento que libera itens; relatório de vendas por parceiro (receita do time, valor devido, repassado, a pagar);
- profissionais e serviços com registro profissional cifrado e contato público somente autorizado;
- disponibilidade sem sobreposição, com bloqueio de horários;
- agendamentos: solicitação em horário livre, confirmação com verificação de conflito, cancelamento pela diretoria ou pelo solicitante, realizado e ausência; notificações e e-mail ao profissional.

### Frontend

- público: `/parceiros`, `/parceiros/[id]` e `/parceiros/servicos/[id]` (horários e solicitação com aviso sobre dados de saúde);
- minha conta: `/minha-conta/agendamentos`;
- painel: parceiros (lista e ficha com contrato, comissão, logo e documentos), profissionais e serviços (com agenda), agendamentos, repasses (lista, geração, relatório e detalhe com pagamento) e seletor de parceiro/comissão na ficha do produto.

## 3. Requisitos atendidos

| Requisito | Situação |
|---|---|
| RF-031 cadastro de parceiros | atendido |
| RF-032 venda de parceiro com repasse | atendido |
| RF-033 profissionais e serviços | atendido |
| RF-034 agendamento | atendido (modo manual, PEN-037) |
| RCF-010 vigência, documentos, logo, comissão, repasse e relatório | atendido |
| RCF-011 disponibilidade e consulta prévia | atendido |
| RF-019 área do cliente (agendamentos) | concluído |

## 4. Validações executadas

| Verificação | Resultado |
|---|---|
| `npm run check` | aprovado (72 testes unitários de API, 7 web) |
| testes de domínio | 7 casos: vigência, transições, sobreposição de comissão, arredondamento e teto, validação, totais com ajuste, intervalos |
| testes de integração | 6 cenários: publicação e venda só de ativo na vigência e documentos restritos; snapshot de comissão com sobreposição; repasse idempotente com saída única no Caixa e bloqueio de estorno; cancelamento de repasse libera itens; agenda sem conflito e cancelamento que libera horário; parceiro aprovado exigido |
| suíte completa de integração | 61 cenários (fases 1 a 6) aprovados |

## 5. Decisões principais

`DT-033` (parceiros, comissão, repasses e agendamento manual). Pendências resolvidas ou parciais: `PEN-034`, `PEN-035`, `PEN-036`, `PEN-037`. Nova: `PEN-052`.

## 6. Pontos em aberto e riscos

- textos contratuais, tributação e responsabilidades dos parceiros dependem do responsável (`PEN-034`);
- recuperação de valor de venda repassada e depois estornada é manual por ajuste (`PEN-052`);
- antecedência mínima, recorrência de agenda e avaliações não foram implementadas (`PEN-037`);
- e-mail ao profissional usa o adaptador local até a escolha do provedor (`PEN-042`).

## 7. Próximo passo

Fase 7 — comunicação (notícias, eventos, fórum e avisos).
