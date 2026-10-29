# Roadmap

## Regra de progressão

Este roadmap é incremental. Nenhuma fase é iniciada sem que a anterior cumpra os critérios técnicos e tenha autorização registrada. Em 2026-10-18 o responsável do projeto aceitou a Fase 0 e autorizou a execução sequencial das fases 1 a 8 (`DT-021`); cada fase continua exigindo lint, testes e build aprovados antes da seguinte.

## Visão resumida

| Fase | Tema | Estado | Dependência |
|---:|---|---|---|
| 0 | Planejamento e infraestrutura | Aceita (2026-10-18) | Nenhuma |
| 1 | Autenticação e administração básica | Implementada (2026-10-18) | Aceite da Fase 0 |
| 2 | Atletas e inscrições | Implementada (2026-10-18) | Fase 1 implementada |
| 3 | Mensalidades e Caixa Fênix | Implementada (2026-10-18) | Fase 2 e regras financeiras (`DT-027`) |
| 4 | Loja | Implementada (2026-10-18) | Fase 3 |
| 5 | Remessas | Implementada (2026-10-19) | Fase 4 |
| 6 | Parceiros e profissionais | Implementada (2026-10-19) | Fase 5 |
| 7 | Comunicação | Implementada (2026-10-19) | Fase 6 |
| 8 | Relatórios, auditoria e otimizações | Implementada (2026-10-19) | Módulos anteriores |
| 9 | Evolução: busca, painel financeiro, app instalável, carteirinha e PIX automático | Autorizada (2026-10-25), em andamento | Fase 8 e `docs/30-REVISAO-GERAL.md` |

Produção com dados reais continua condicionada às pendências P0 jurídicas e operacionais (`PEN-010`, `PEN-011`, `PEN-014`, `PEN-041`, `PEN-044`).

## Fase 0 — Planejamento e infraestrutura

**Objetivo:** criar uma base reproduzível, documentada e testável sem implementar funcionalidades de negócio.

**Entregas:**

- documentação consolidada, rastreabilidade e pendências;
- arquitetura modular e decisões técnicas;
- modelo conceitual/lógico, dicionário inicial e ERD;
- monorepo com front-end, API e pacotes compartilhados;
- TypeScript `strict`, lint, formatação e testes iniciais;
- PostgreSQL em Docker Compose e Prisma preparado;
- `.env.example`, política de segredos e instruções de execução;
- integração contínua básica, se o ambiente da entrega permitir;
- verificações de inicialização e gate reproduzível com `npm ci` seguido de `npm run check`.

**Não inclui:** checkout real, gateway, caixa completo, loja/fórum/agendamento funcionais, upload em nuvem ou integrações externas.

**Critérios de saída:**

1. todos os documentos previstos existem, são coerentes e têm conflitos/pendências visíveis;
2. arquitetura, banco e decisões estão registrados;
3. front-end, API e PostgreSQL iniciam conforme instruções reproduzíveis;
4. `npm ci` e `npm run check` passam em ambiente limpo;
5. nenhum segredo real está versionado;
6. `PEN-001` está resolvida com aprovação explícita da especificação consolidada;
7. `PEN-002` está resolvida com responsáveis e aprovadores nomeados para produto, tecnologia, financeiro, privacidade e segurança;
8. o responsável autorizado em `PEN-002` valida o pacote e autoriza formalmente a Fase 1.

## Fase 1 — Autenticação e administração básica

**Objetivo:** estabelecer identidade, autorização e configurações antes dos domínios operacionais.

**Gate de proteção de menores:** a estrutura técnica pode ser desenvolvida e testada com dados fictícios e acesso restrito. Conta, recuperação, área autenticada ou site público em produção com acesso provável por crianças ou adolescentes não podem ser liberados enquanto `PEN-010` não tiver análise LGPD/ECA Digital documentada e decisões de idade, supervisão e minimização aprovadas.

**Entregas:**

- login, logout, recuperação de senha e gestão de sessões;
- usuários, papéis e permissões granulares;
- painel administrativo mínimo;
- configurações públicas/privadas do time;
- logos e arquivos institucionais;
- auditoria-base de ações sensíveis;
- site público institucional mínimo.

**Rastreabilidade:** RF-001, RF-005 a RF-007, RF-020 (estrutura), RF-023, RF-024 (base), RF-039, RCF-014; RNF-003 a RNF-005, RNF-018, RNF-021.

**Critérios de saída:**

- testes positivos e negativos de autorização em todas as rotas;
- recuperação e revogação não expõem conta ou token;
- configurações autorizadas refletem sem deploy;
- uploads institucionais seguem validação e acesso;
- auditoria registra mudanças de papéis/configurações;
- revisão de acessibilidade e segurança concluída.

## Fase 2 — Atletas e inscrições

**Objetivo:** digitalizar interessados, seletivas, atletas e vínculos de equipe.

**Entregas:**

- equipes/categorias e variações públicas;
- interessados;
- seletivas e inscrições;
- análise de inscrição e conversão rastreável;
- atletas, status e vínculos históricos;
- primeira versão da área do atleta;
- indicadores administrativos correspondentes.

**Rastreabilidade:** RF-002 a RF-004, RF-008 a RF-010, RF-019 (dados/inscrições), RF-020 (atletas/inscrições), RF-021 (atletas/inscrições), RF-022 (inscrição).

**Pré-decisões necessárias:** campos obrigatórios, duplicidade, transições e impactos de inativação. `PEN-010` é gate explícito para qualquer jornada pública ou uso real envolvendo menores: exige análise LGPD/ECA Digital e decisões aprovadas sobre idade, supervisão, vínculo/acesso de responsável e minimização.

**Critérios de saída:**

- cadastro público tem aviso de privacidade e minimização;
- `PEN-010` está resolvida para as jornadas e faixas etárias realmente liberadas;
- transições aprovadas e auditadas;
- atleta acessa apenas registros próprios;
- vínculos preservam histórico;
- relatórios/indicadores conciliam com fontes.

## Fase 3 — Mensalidades e Caixa Fênix

**Objetivo:** criar controle financeiro confiável antes de conectar a loja.

**Entregas:**

- planos, geração de mensalidades, inadimplência e pagamento manual/PIX;
- contas financeiras, categorias, centros de custo e métodos;
- receitas, despesas, transferências, contas a pagar/receber;
- comprovantes e metadados de arquivo;
- integração mensalidade–Caixa;
- conciliação, fechamento e reabertura autorizada;
- relatórios financeiros iniciais e notificações de cobrança.

**Rastreabilidade:** RF-011 a RF-014, RF-019 (mensalidades/pagamentos), RF-020 (mensalidades), RF-021/022 (financeiro), RF-025 a RF-030, RF-045; RCF-002 a RCF-006.

**Pré-decisões necessárias:** plano de contas/categorias, moeda, competência, parcialidade, multas/descontos, anexos, aprovação, fechamento e retenção.

**Critérios de saída:**

- dinheiro usa Decimal e saldo é reproduzível por movimentações;
- confirmação automática é idempotente e transacional;
- registro confirmado não é destruído;
- estorno/reembolso/cancelamento são vinculados e auditados;
- fechamento/reabertura respeitam permissões;
- testes financeiros de concorrência, arredondamento e falha parcial passam.

## Fase 4 — Loja

**Objetivo:** oferecer catálogo e pedido de estoque tradicional com integração financeira.

**Entregas:**

- categorias, produtos, imagens, variações e SKU;
- estoque e movimentações;
- carrinho e favoritos;
- pedido de usuário ou visitante identificado;
- pagamento manual e integração pedido–Caixa;
- separação, entrega, cancelamento e área de pedidos.

**Rastreabilidade:** RF-015 a RF-018, RF-019 (pedidos), RF-020/021 (vendas), RF-022 (pedido), RF-029 (pedido), RF-037, RF-038, RCF-008.

**Pré-decisões necessárias:** reserva/baixa, expiração do carrinho, preço promocional, limite por comprador, consulta de visitante, cancelamento e devolução.

**Critérios de saída:**

- pedido/estoque/pagamento/caixa permanecem consistentes sob concorrência;
- preço e variação são preservados no item;
- visitante consulta pedido por mecanismo seguro;
- favoritos e carrinho obedecem ao contexto da loja;
- jornada responsiva e acessível é validada.

## Fase 5 — Remessas

**Objetivo:** suportar uniformes e produtos vendidos por período antes da encomenda ao fornecedor.

**Entregas:**

- campanhas/remessas, produtos e variações vinculados;
- abertura/encerramento e mínimos/máximos;
- relatório consolidado para malharia;
- acompanhamento de encomenda/produção;
- recebimento, notificação e retirada;
- cancelamento e reembolso vinculado.

**Rastreabilidade:** RF-035, RF-036, RF-044, RCF-007 (campanha/encomenda), RCF-009.

**Pré-decisões necessárias:** mínimo/máximo, extensão de prazo, produção, retirada, reembolso e retorno ao estoque.

**Critérios de saída:**

- venda fora do período/estado é impedida;
- consolidação coincide com pedidos confirmados;
- cancelamento não apaga histórico financeiro;
- notificação é idempotente e limitada a compradores afetados;
- retirada fica rastreável.

## Fase 6 — Parceiros e profissionais

**Objetivo:** operar parceiros sob curadoria, com separação financeira e agendamento.

**Entregas:**

- cadastro, aprovação, contrato, documentos e logos;
- produtos de parceiro e origem no pedido;
- comissões, repasses e relatórios;
- profissionais, serviços e disponibilidade;
- solicitação, confirmação e cancelamento de agendamento;
- notificações às partes.

**Rastreabilidade:** RF-031 a RF-034, RF-032 integrado à loja; RCF-010, RCF-011.

**Pré-decisões necessárias:** contrato, responsabilidade por entrega/atendimento, comissão, liquidação, perfil de parceiro, agenda, cancelamento e ausência.

**Critérios de saída:**

- apenas parceiro aprovado é publicado;
- receita do time e dívida com parceiro são separáveis;
- documentos têm acesso restrito;
- agenda evita conflito;
- nenhum prontuário/dado de saúde é coletado.

## Fase 7 — Comunicação

**Objetivo:** unificar divulgação institucional e interação moderada.

**Entregas:**

- notícias, categorias, agendamento e destaque;
- eventos e partidas;
- publicação multicanal sem duplicação;
- fórum, tópicos, comentários, reações e denúncias;
- visibilidade, fixação, fechamento e moderação;
- notificações.

**Rastreabilidade:** RF-040 a RF-043, RF-022 ampliado; RCF-001, RCF-012, RCF-013.

**Pré-decisões necessárias:** política editorial, perfis por categoria, termos da comunidade, antispam, SLA/recurso de moderação e retenção.

**Critérios de saída:**

- conteúdo restrito não vaza em API, busca ou contagem;
- uma notícia/evento alimenta os canais configurados;
- publicação agendada respeita UTC;
- moderação preserva histórico e motivo;
- controles contra abuso e testes de segurança passam.

## Fase 8 — Relatórios, auditoria e otimizações

**Objetivo:** consolidar governança, escala, observabilidade, acessibilidade e desempenho.

**Entregas:**

- relatórios integrados e exportações autorizadas;
- auditoria completa e consultas de governança;
- painéis e indicadores finais;
- monitoramento, alertas e runbooks;
- testes de carga, recuperação e compatibilidade;
- auditoria de segurança, privacidade e acessibilidade;
- otimizações baseadas em medições.

**Rastreabilidade:** RF-020, RF-021, RF-024, RF-045; RNF-001 a RNF-022.

**Critérios de saída:**

- totais e exportações conciliam com dados de origem;
- exportação respeita minimização e permissão própria;
- metas aprovadas de SLO, desempenho e recuperação são atendidas;
- riscos altos têm mitigação ou aceite formal;
- documentação operacional e de privacidade está atualizada.

## Fase 9 — Evolução

**Autorização:** o responsável do projeto aprovou em 2026-10-25 todas as recomendações de `docs/30-REVISAO-GERAL.md` ("aplique tudo, e tem minha total aprovação de tudo que foi indicado"), o que inclui o pagamento automático (gateway), antes listado como sem fase autorizada. A presença em treinos também estava aprovada, mas foi **cancelada pelo responsável em 2026-10-26** antes de ser entregue.

**Entregas:**

- busca global no painel (`DT-057`);
- painel financeiro com gráficos (`DT-058`);
- app instalável (PWA) (`DT-059`);
- carteirinha digital com QR, de atleta e de afiliado, com benefícios de parceiros (`DT-068`);
- afiliação vendida pela loja, produtos personalizados (`DT-069`) e entrega comprovada com desistência e defeito (`DT-070`), aprovados em 2026-10-27;
- PIX com confirmação automática por intermediário de pagamento;
- entrega em casa com comprovante de entrega (`DT-075`), entregue em 2026-10-28: retirada ou entrega por região, frete grátis, endereços, entregadores, código de 4 dígitos, link do motoboy, provas e "Não recebi".

- cartão de crédito e débito pelo site com Mercado Pago (`DT-079`), entregue em 2026-10-28 em modo de teste: até 12x com juros pagos pelo cliente, sem juros por produto (códigos do Mercado Pago, `PEN-067`), estorno pela fila. O conector real aguarda as credenciais do clube.

**Regra:** onde a regra de negócio não estiver definida, adota-se a recomendação registrada e a dúvida vai para `PENDENCIAS.md`, como em todo o projeto.

## Gates obrigatórios de cada fase

1. **Escopo:** requisitos, regras e decisões da fase aprovados.
2. **Design:** fluxos, estados, permissões e dados revisados.
3. **Segurança/LGPD:** ameaça, minimização, base legal e retenção avaliadas.
4. **Implementação:** limites de módulo respeitados, migrações reversíveis e erros seguros.
5. **Qualidade:** testes proporcionais ao risco, lint e build bem-sucedidos.
6. **Operação:** logs, métricas, backup/runbook e rollback quando aplicável.
7. **Aceite:** evidências registradas e autorização explícita para a próxima fase.

## Definição transversal de pronto

Um módulo só é considerado pronto quando:

- requisitos e critérios têm testes rastreáveis;
- autorização é testada no servidor;
- entradas inválidas e falhas não deixam estado inconsistente;
- auditoria cobre mudanças sensíveis;
- acessibilidade e responsividade foram verificadas;
- dados pessoais e logs seguem `13-SEGURANCA-E-LGPD.md`;
- documentação, API, modelo e decisões foram atualizados;
- lint, testes e build oficiais passam;
- nenhuma pendência bloqueadora permanece sem decisão/aceite de risco.

## Itens futuros sem fase autorizada

- aplicativo móvel nativo;
- checkout com cartão e outros meios além do PIX (o PIX automático entrou na Fase 9);
- produto digital;
- avaliações de profissionais;
- scout, treino, presença e estatísticas avançadas (presença cancelada em 2026-10-26);
- prontuário ou qualquer dado de saúde;
- marketplace aberto;
- integrações externas não detalhadas.
