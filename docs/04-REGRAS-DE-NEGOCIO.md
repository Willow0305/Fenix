# Regras de negócio

## Convenções

- `Definida`: regra expressa no documento-base, briefing ou `AGENTS.md`.
- `Provisória`: interpretação recomendada para viabilizar análise/testes, mas que depende de aprovação antes da implementação irreversível.
- Uma regra não substitui o requisito relacionado; ela descreve invariantes e decisões operacionais.

## Acesso, contas e identidade

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-AUT-001 | Perfil privilegiado nunca pode ser escolhido e aceito apenas pelo cliente; deve ser atribuído por administrador ou fluxo de aprovação autorizado. | Definida | RF-005, RF-007 |
| RN-AUT-002 | Autenticação deve oferecer login, logout e recuperação de senha, sem guardar senha reversível. | Definida | RF-006, RNF-003 |
| RN-AUT-003 | Toda ação administrativa deve ser autenticada e autorizada no servidor por permissão específica. | Definida | RF-007, RNF-005 |
| RN-AUT-004 | O front-end pode ocultar ações, mas não é autoridade de autorização. | Definida | `AGENTS.md` |
| RN-AUT-005 | O modelo RBAC aceita múltiplos papéis por usuário conforme `DT-007`; quais combinações são permitidas e como tratar conflitos dependem da matriz aprovada em `PEN-007`. | Definida quanto ao mecanismo; matriz provisória | `DT-007`; `PEN-007`; `05-PERFIS-E-PERMISSOES.md` |
| RN-AUT-006 | Acesso de responsável a dados de atleta exige vínculo, escopo e fundamento jurídico previamente definidos. | Provisória | Público-alvo do PDF; LGPD |

## Interessados, seletivas, atletas e equipes

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-ATL-001 | Cadastro de interessado e inscrição em seletiva são registros distintos, embora possam compartilhar dados de contato. | Definida | RF-003, RF-004 |
| RN-ATL-002 | Apenas seletiva ativa e apta a receber inscrições pode aceitar nova inscrição. | Definida | RF-004 |
| RN-ATL-003 | Estados canônicos da inscrição incluem nova, em análise, aprovada, recusada e compareceu; o PDF técnico também cita “não compareceu”. A inclusão deste último no fluxo final é provisória. | Provisória | RF-004; SQL ilustrativo do PDF |
| RN-ATL-004 | Aprovar inscrição não deve apagar sua origem; a eventual criação de atleta mantém vínculo rastreável. | Definida | Relacionamentos do PDF, RF-004, RF-008 |
| RN-ATL-005 | Alterações importantes do atleta registram autoria e histórico na extensão permitida pela LGPD. | Definida | RF-009, RF-024 |
| RN-ATL-006 | O vínculo atleta–equipe possui período e preserva histórico; terminar um vínculo não apaga os anteriores. | Definida | RF-010 |
| RN-ATL-007 | Critérios de duplicidade, campos obrigatórios, sobreposição de vínculos e conversão de inscrição em atleta ainda precisam de aprovação. | Provisória | Pontos em aberto do PDF |
| RN-ATL-008 | Dados de saúde e prontuário não integram o cadastro de atleta nesta fase. | Definida | `AGENTS.md`, briefing §10 |

## Planos, mensalidades e pagamentos

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-MEN-001 | Plano de mensalidade registra valor, vencimento e situação; sua inativação não altera cobranças históricas. | Definida | RF-011, integridade histórica |
| RN-MEN-002 | Mensalidade identifica atleta, plano aplicado, mês de referência e vencimento. | Definida | RF-012 |
| RN-MEN-003 | A geração deve impedir cobrança duplicada para a mesma chave de negócio aprovada. A chave exata além de atleta/mês permanece provisória. | Provisória | RF-012; SQL ilustrativo |
| RN-MEN-004 | Pagamento registra método, valor, data, origem e comprovante/observação quando aplicável. | Definida | RF-013 |
| RN-MEN-005 | Mensalidade paga gera ou vincula exatamente uma entrada no Caixa Fênix. | Definida | RF-029 |
| RN-MEN-006 | Pagamentos parciais são sugeridos pelo relacionamento do PDF, mas regras de saldo, múltiplos métodos, juros, multa e desconto não estão aprovadas. | Provisória | PDF §9.2 |
| RN-MEN-007 | Alteração/cancelamento de pagamento confirmado não apaga o original e exige ação financeira corretiva auditável. | Definida | `AGENTS.md`, RNF-017 |

## Caixa Fênix

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-FIN-001 | Todo valor monetário usa `Decimal`/`NUMERIC`, com moeda explícita; `float`/`double` é proibido. | Definida | `AGENTS.md`, RCNF-004 |
| RN-FIN-002 | O saldo é calculado pelas movimentações confirmadas; saldo editável não é fonte de verdade. | Definida | RF-025, briefing §8 |
| RN-FIN-003 | Movimentação identifica conta, tipo, categoria, valor, datas aplicáveis, origem, status e responsável. | Definida | RF-026, RF-027, RCF-002 |
| RN-FIN-004 | Lançamento confirmado não pode ser apagado definitivamente nem reescrito para ocultar histórico. | Definida | `AGENTS.md`, RCF-005 |
| RN-FIN-005 | Cancelamento, correção, estorno e reembolso preservam o original, registram autor, instante e motivo e mantêm vínculo quando aplicável. | Definida | `AGENTS.md`, RCF-005 |
| RN-FIN-006 | Estorno referencia o lançamento original; reembolso gera saída vinculada à origem. | Definida | Briefing §8 |
| RN-FIN-007 | Pedido pago e mensalidade paga geram/vinculam entrada automática idempotente. | Definida | RF-029 |
| RN-FIN-008 | Cada movimentação automática informa a origem — mensalidade, pedido, parceiro ou outra origem aprovada. | Definida | RF-029, RNF-017 |
| RN-FIN-009 | Transferência entre contas possui duas pernas vinculadas, de mesmo valor/moeda, sem criar receita ou despesa líquida. | Definida quanto ao suporte; modelo técnico a confirmar | RCF-003 |
| RN-FIN-010 | Fechamento registra conta, período, saldo esperado/contado, diferença, observação e responsável. | Definida | RF-030 |
| RN-FIN-011 | Reabertura exige permissão específica, motivo e auditoria; o fechamento anterior permanece histórico. | Definida | Briefing §8 |
| RN-FIN-012 | Regras de competência, aprovação, anexos obrigatórios, categorias e periodicidade de fechamento ainda precisam ser aprovadas. | Provisória | Estudo de riscos do PDF |

## Loja, produtos, estoque e pedidos

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-LOJ-001 | Produto possui um modo de venda aplicável: estoque tradicional, encomenda, campanha/remessa ou parceiro. Produto digital permanece futuro. | Definida | RF-035, RCF-007 |
| RN-LOJ-002 | Preço e custo usam Decimal; item de carrinho/pedido deve guardar a referência e o preço efetivamente aplicados. | Definida | RCNF-004, integridade de pedido |
| RN-LOJ-003 | Pedido pode pertencer a usuário autenticado ou visitante identificado por dados mínimos. | Definida | RF-017 |
| RN-LOJ-004 | Estados canônicos de pedido: criado, aguardando pagamento, pago, separado, entregue e cancelado. | Definida | RF-018 |
| RN-LOJ-005 | Confirmação do pedido reduz estoque uma única vez; o evento exato que caracteriza “confirmado” deve ser definido antes da implementação. | Provisória | RF-016 |
| RN-LOJ-006 | Ajuste manual de estoque exige diretoria autorizada, quantidade, motivo, autoria e histórico. | Definida | RF-016, RF-024 |
| RN-LOJ-007 | Carrinho deve revalidar preço, variação, limite e disponibilidade no servidor antes de criar pedido. | Definida quanto à consistência | RF-037, RNF-019 |
| RN-LOJ-008 | Favoritos pertencem a usuário autenticado, são privados e aparecem apenas no contexto da loja. | Definida | RF-038 |
| RN-LOJ-009 | Carrinho e favorito não devem dominar a navegação fora da loja; carrinho pode ser indicado globalmente quando contiver itens, conforme UX aprovada. | Definida | Briefing §9 |
| RN-LOJ-010 | Pedido pago gera/vincula entrada no Caixa; reembolso gera saída vinculada. | Definida | RF-029, RCF-005 |

## Campanhas e remessas

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-REM-001 | Campanha possui início anterior ao encerramento e aceita pedidos apenas durante o período/estado de venda. | Definida | RF-036 |
| RN-REM-002 | Campanha registra mínimos/máximos quando configurados, previsões, envio à malharia, produção, chegada e retirada. | Definida | RCF-009 |
| RN-REM-003 | Encerramento produz relatório consolidado de itens e variações para conferência antes do fornecedor. | Definida | Briefing §9 |
| RN-REM-004 | Não atingir o mínimo permite cancelamento conforme política aprovada; reembolso deve vincular cada pagamento afetado. | Definida quanto ao suporte; política provisória | RCF-009 |
| RN-REM-005 | Registrar chegada permite notificar apenas compradores da remessa, com local e prazo vigentes. | Definida | RF-044 |
| RN-REM-006 | Retirada precisa de confirmação rastreável; responsável, comprovação e prazo ainda dependem de regra operacional. | Provisória | Briefing §9 |

## Parceiros, profissionais e agendamentos

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-PAR-001 | Somente parceiro cadastrado, aprovado e ativo pode ter oferta publicada. | Definida | Escopo §2.2 do PDF, RF-031 |
| RN-PAR-002 | Produto/serviço preserva sua origem e regra de comissão/repasse aplicada. | Definida | RF-032, RCF-010 |
| RN-PAR-003 | Receita do time e valor devido ao parceiro devem ser apuráveis separadamente. | Definida | Briefing §10 |
| RN-PAR-004 | Documentos e termos comerciais possuem acesso restrito e retenção definida. | Definida quanto à proteção; prazo provisório | RNF-004, RCF-010 |
| RN-PAR-005 | Profissional é vinculado a parceiro aprovado e publica apenas contatos/serviços autorizados. | Definida | RF-033 |
| RN-PAR-006 | Solicitação de atendimento não equivale a confirmação; diretoria ou parceiro autorizado confirma/cancela. | Definida | RF-034 |
| RN-PAR-007 | Perfil próprio de parceiro, agenda, antecedência, conflito de horário, cancelamento, ausência e avaliação dependem de decisão. | Provisória | Briefing §10 |
| RN-PAR-008 | Nenhum serviço pode registrar prontuário ou dado de saúde nesta fase. | Definida | Briefing §10, `AGENTS.md` |

## Fórum, notícias, eventos e notificações

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-COM-001 | Leitura, publicação, comentário, reação e moderação dependem de visibilidade e permissão verificadas no servidor. | Definida | RF-040, RNF-020 |
| RN-COM-002 | Conteúdo removido por moderação usa exclusão lógica/ocultação e mantém histórico autorizado. | Definida | RF-043 |
| RN-COM-003 | Moderação registra moderador, instante, ação e motivo quando aplicável. | Definida | RF-043, RF-024 |
| RN-COM-004 | Notícia possui rascunho/publicação e pode ser exibida em canais configurados sem duplicação manual. | Definida | RF-041, RF-042 |
| RN-COM-005 | Publicação agendada usa instante UTC e só se torna pública no momento/estado configurado. | Definida | RCF-013, regra UTC |
| RN-COM-006 | Notícia pode relacionar-se a evento/partida em vez de copiar seus dados. | Definida | RCF-001 |
| RN-COM-007 | Notificação é destinada ao ator correto, não expõe dados desnecessários e deve evitar duplicidade para o mesmo evento. | Definida quanto à segurança/consistência | RF-022, RF-044 |
| RN-COM-008 | Categorias, quem publica, limites de reação/denúncia e SLA de moderação ainda precisam de política. | Provisória | Briefing §11 |

## Configurações, arquivos e auditoria

| ID | Regra | Estado | Rastreabilidade |
|---|---|---|---|
| RN-CFG-001 | Contatos, links, textos e logos configuráveis devem mudar sem deploy. | Definida | RF-023, RF-039, RNF-021 |
| RN-CFG-002 | Dado configurável precisa ter classificação explícita de visibilidade; PIX/dados bancários não são públicos por padrão sem aprovação. | Provisória recomendada | RCF-014, LGPD/segurança |
| RN-CFG-003 | Logo oficial, masculino, feminino e diretoria são contextos distintos; a marca Floresta não é identidade permanente. | Definida | RF-039, briefing §§12–13 |
| RN-ARQ-001 | Arquivo não é armazenado como binário no banco; persistem metadados, hash/integridade e chave/URL segura. | Definida | `AGENTS.md`, RF-028 |
| RN-ARQ-002 | Upload exige autorização, limite, extensão permitida, MIME real e política de acesso; URL assinada é usada quando necessário. | Definida | `AGENTS.md`, RNF-018 |
| RN-AUD-001 | Logs não contêm senha, token, conteúdo de comprovante ou dado pessoal privado desnecessário. | Definida | `AGENTS.md`, RNF-013 |
| RN-AUD-002 | Auditoria registra autor, instante, ação, entidade, motivo e valores anterior/novo quando necessário e permitido. | Definida | RF-024, RNF-017 |

## Estados conhecidos e lacunas de transição

| Objeto | Estados conhecidos nas fontes | Lacuna antes da implementação |
|---|---|---|
| Inscrição em seletiva | nova, em análise, aprovada, recusada, compareceu; “não compareceu” aparece no SQL ilustrativo | transições, reversão e quem decide |
| Atleta | pendente, ativo, inativo, suspenso no SQL ilustrativo | motivos, efeitos em mensalidade/equipe e reativação |
| Mensalidade | aberta, paga, atrasada, cancelada | pagamento parcial, reabertura, juros e cancelamento |
| Pagamento | pendente, pago/confirmado, cancelado, reembolsado | confirmação, correção e múltiplos métodos |
| Pedido | criado, aguardando pagamento, pago, separado, entregue, cancelado | transições válidas, reserva/baixa e reembolso |
| Campanha/remessa | rascunho, aberta, encerrada, encomendada, recebida, finalizada, cancelada | mínimos, produção, reabertura e retirada parcial |
| Agendamento | solicitado, confirmado, concluído, cancelado, não compareceu | antecedência, conflito, responsável e cobrança |
| Tópico/notícia | rascunho/publicado, oculto/fechado/arquivado conforme objeto | agendamento, revisão, recurso e retenção |
| Lançamento financeiro | pendente, confirmado, cancelado; correções vinculadas | aprovação, competência, fechamento e período bloqueado |

Nenhuma transição ausente deve ser presumida silenciosamente.
