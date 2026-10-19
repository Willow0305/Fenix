# Requisitos funcionais

## Convenções

- `RF-001` a `RF-045` são requisitos canônicos do documento-base e não podem ser renumerados, reduzidos ou removidos.
- `RCF-*` identifica requisitos complementares explícitos do briefing. Eles não substituem a faixa canônica.
- “Fase” indica o primeiro horizonte planejado; requisitos transversais podem amadurecer em fases posteriores.
- Critérios de aceite abaixo tornam a intenção verificável, sem decidir regras de negócio que as fontes deixaram abertas.

## Requisitos canônicos RF-001 a RF-045

| ID | Requisito consolidado | Pri. | Critério mínimo de aceite | Fase inicial |
|---|---|---:|---|---:|
| RF-001 | Exibir site público com identidade Fênix, apresentação do time e chamadas para inscrição, loja e contato. | Alta | Visitante acessa a página inicial e encontra conteúdo institucional e os três caminhos; conteúdo privado não é exposto. | 1 |
| RF-002 | Exibir páginas ou filtros para time masculino, feminino e categorias futuras. | Média | Categoria ativa pode ser selecionada e apresenta somente conteúdo associado; ausência de conteúdo tem estado vazio. | 2 |
| RF-003 | Cadastrar interessado com nome, contato, data de nascimento, posição e observações. | Alta | Entrada válida gera registro e confirmação; inválida não persiste e informa correções sem vazar dados. | 2 |
| RF-004 | Inscrever pessoa em seletiva ativa e manter os estados nova, em análise, aprovada, recusada ou compareceu. | Alta | Apenas seletiva dentro do período/estado permitido aceita inscrição; diretoria autorizada altera status e a alteração fica rastreável. | 2 |
| RF-005 | Criar conta com e-mail, senha e perfil definido por administrador ou fluxo de aprovação. | Alta | E-mail válido e não duplicado cria conta no estado previsto; perfil privilegiado não é autoatribuído pelo cliente. | 1 |
| RF-006 | Autenticar usuário, encerrar sessão e recuperar senha. | Alta | Credenciais válidas iniciam sessão; logout invalida o acesso aplicável; recuperação usa token limitado e não revela se uma conta existe. | 1 |
| RF-007 | Diferenciar permissões de administrador, diretoria, atleta e visitante. | Alta | Cada operação protegida é autorizada no servidor; tentativa sem permissão recebe resposta segura e é auditada quando sensível. | 1 |
| RF-008 | Cadastrar atleta com dados pessoais, contato, categoria, posição e status. | Alta | Usuário autorizado cria atleta com campos obrigatórios válidos; duplicidade e inconsistências são impedidas conforme regras aprovadas. | 2 |
| RF-009 | Editar atleta e registrar alterações importantes. | Alta | Edição autorizada preserva histórico dos campos sensíveis definidos; alteração inválida não é aplicada. | 2 |
| RF-010 | Vincular atleta a uma ou mais equipes/categorias ao longo do tempo. | Alta | Vínculo registra período e situação sem apagar vínculos históricos; sobreposições inválidas seguem regra aprovada. | 2 |
| RF-011 | Cadastrar planos de mensalidade com valor, dia de vencimento e situação ativa/inativa. | Alta | Plano válido pode ser ativado/inativado; inativação não modifica cobranças históricas. | 3 |
| RF-012 | Gerar mensalidades por atleta conforme plano, mês de referência e vencimento. | Alta | Geração evita duplicidade para a mesma regra de cobrança e preserva valor/referência aplicados no momento. | 3 |
| RF-013 | Registrar pagamentos manuais e preparar evolução para automáticos, com método, valor, data e comprovante/observação. | Alta | Pagamento válido fica vinculado à origem, registra responsável e não pode ocultar histórico após confirmação. | 3 |
| RF-014 | Consultar mensalidades abertas, atrasadas e pagas com filtros por mês, atleta e equipe. | Alta | Filtros retornam apenas dados autorizados e estados coerentes com vencimento/pagamentos. | 3 |
| RF-015 | Cadastrar produtos com nome, descrição, preço, categoria, estoque e imagem. | Alta | Produto válido é criado com preço decimal não negativo e mídia referenciada com acesso adequado. | 4 |
| RF-016 | Controlar estoque, reduzindo-o quando o pedido for confirmado e permitindo ajuste manual pela diretoria. | Média | Confirmação executa uma única baixa consistente; ajuste exige permissão, motivo e histórico. O marco exato de “confirmado” é provisório. | 4 |
| RF-017 | Registrar pedido de usuário autenticado ou visitante identificado. | Alta | Pedido guarda identificação mínima, itens e preços históricos; falha transacional não cria pedido parcial. | 4 |
| RF-018 | Acompanhar pedido nos estados criado, aguardando pagamento, pago, separado, entregue ou cancelado. | Alta | Usuário autorizado consulta o estado; transição registra autor/instante e respeita transições aprovadas. | 4 |
| RF-019 | Oferecer área do atleta para dados, mensalidades, pagamentos, pedidos e inscrições. | Alta | Atleta autenticado consulta somente seus dados e recebe estados vazios/erros seguros para módulos ainda sem registros. | 2–4 |
| RF-020 | Exibir painel administrativo com total de atletas, mensalidades abertas, inscrições novas e vendas do mês. | Alta | Indicadores usam definições e período explícitos, respeitam permissão e permitem rastrear a origem do total. | 2–4 |
| RF-021 | Gerar relatórios simples de atletas, financeiro, vendas e inscrições. | Média | Relatório autorizado aplica filtros, informa período/fuso e produz totais coerentes com os registros de origem. | 3–8 |
| RF-022 | Registrar notificações internas de cobrança, inscrição aprovada ou pedido atualizado. | Média | Evento elegível cria notificação idempotente ao destinatário correto e permite leitura sem expor conteúdo de terceiros. | 3–7 |
| RF-023 | Permitir ao administrador editar informações públicas, contatos, links sociais e parâmetros do time. | Média | Alteração válida reflete sem deploy, registra responsável e não publica segredo ou dado bancário em área indevida. | 1 |
| RF-024 | Auditar ações sensíveis, incluindo alteração de pagamento, exclusão de produto e mudança de status de atleta. | Alta | Log imutável registra autor, instante, ação, entidade, motivo quando exigido e valores anterior/novo quando permitido. | 1–8 |
| RF-025 | Disponibilizar o Caixa Fênix com saldo, entradas, saídas, pendências e movimentações por período. | Alta | Saldos são derivados de movimentações confirmadas; visão apresenta conta/período/moeda e não oferece saldo editável como verdade. | 3 |
| RF-026 | Registrar receitas e despesas manuais com valor, data, categoria, conta, responsável, descrição e status. | Alta | Lançamento válido usa Decimal, moeda explícita, autoria e origem manual; confirmação/cancelamento preservam histórico. | 3 |
| RF-027 | Categorizar finanças, incluindo mensalidade, venda, parceiro, material esportivo, aluguel, taxa, transporte e outros. | Alta | Categoria possui tipo coerente e pode ser inativada sem alterar lançamentos históricos; plano final depende de aprovação. | 3 |
| RF-028 | Anexar comprovantes, recibos, notas, imagens ou PDFs a pagamentos e movimentações. | Alta | Arquivo permitido é validado e armazenado fora do banco; metadados, integridade, vínculo e autorização ficam registrados. | 3 |
| RF-029 | Gerar ou vincular automaticamente entrada no Caixa Fênix quando pagamento de mensalidade ou pedido for confirmado. | Alta | Cada confirmação cria/vincula exatamente uma entrada identificável; repetição do evento não duplica o financeiro. | 3–4 |
| RF-030 | Conciliar saldo por conta e fechar caixa por período com observação e responsável. | Média | Conferência registra saldo esperado/contado, diferença, período e responsável; fechamento bloqueia mudanças incompatíveis. | 3 |
| RF-031 | Cadastrar parceiros com contato, tipo, status, comissão e observações comerciais. | Alta | Parceiro precisa estar aprovado/ativo antes de operar; dados comerciais têm acesso limitado e mudanças ficam rastreáveis. | 6 |
| RF-032 | Vender produto próprio ou de parceiro, identificando origem, repasse e pedido. | Alta | Item vendido preserva parceiro/origem e regra financeira aplicada; valores do time e devidos ao parceiro são separáveis. | 6 |
| RF-033 | Cadastrar profissionais parceiros, serviços, valores e contatos. | Média | Profissional é vinculado a parceiro aprovado; publicação respeita status e exibe apenas contato autorizado. | 6 |
| RF-034 | Solicitar/agendar serviço parceiro, com confirmação pela diretoria ou parceiro. | Média | Solicitação registra serviço, solicitante e situação; confirmação ou cancelamento exige autorização e notifica as partes aplicáveis. | 6 |
| RF-035 | Definir produto como estoque imediato ou remessa/campanha oculta. | Alta | Modo de venda é obrigatório e determina disponibilidade/validações sem misturar saldo de estoque com campanha. | 4–5 |
| RF-036 | Controlar remessa com abertura, encerramento, status junto ao fornecedor/malharia, previsão de chegada e retirada. | Alta | Venda respeita período; mudanças de etapa registram responsável; relatório consolida itens/variações sem pedido órfão. | 5 |
| RF-037 | Manter carrinho com itens, quantidades, variações e total antes da finalização. | Alta | Carrinho recalcula disponibilidade e preço no servidor antes de converter; erro não gera pedido parcial. | 4 |
| RF-038 | Permitir a usuário autenticado favoritar produtos e exibir favoritos somente no contexto da loja. | Média | Favoritar/desfavoritar é idempotente, privado ao usuário e não aparece na navegação global fora das condições de UX. | 4 |
| RF-039 | Configurar logos oficial, masculino, feminino e da diretoria. | Alta | Upload autorizado valida arquivo, preserva metadados e permite pré-visualizar contexto; permissão exata é provisória. | 1 |
| RF-040 | Disponibilizar fórum com comunicados, tópicos, comentários e interação conforme permissão. | Média | Visibilidade e ações são validadas no servidor; usuário sem permissão não lê nem publica conteúdo restrito. | 7 |
| RF-041 | Cadastrar notícias/comunicados com título, texto, data, horário, local, imagem, status e destaque. | Alta | Rascunho válido pode ser publicado por autorizado; publicação registra autor e instante e valida mídia/data. | 7 |
| RF-042 | Exibir notícia pública na página inicial e no fórum/comunicados quando configurado. | Alta | Uma única notícia pode alimentar os canais selecionados sem cópia manual; retirada de publicação reflete em todos. | 7 |
| RF-043 | Editar, ocultar ou remover logicamente conteúdo inadequado, mantendo auditoria. | Alta | Moderação exige permissão e motivo quando aplicável; conteúdo deixa a visão comum sem perder histórico autorizado. | 7 |
| RF-044 | Notificar compradores quando remessa chegar, informando local e prazo de retirada. | Média | Recebimento confirmado dispara notificação idempotente somente aos compradores afetados, com dados de retirada vigentes. | 5 |
| RF-045 | Gerar relatórios do Caixa sobre saldo, entradas, saídas, vendas, mensalidades, despesas, parceiros e comprovantes pendentes. | Alta | Filtros e totais conciliam com movimentações; relatório identifica período, conta, moeda, origem e geração. | 3–8 |

## Requisitos complementares explícitos do briefing

| ID | Complemento | Critério mínimo de aceite | Fonte | Fase |
|---|---|---|---|---:|
| RCF-001 | Gerenciar eventos e partidas e relacioná-los opcionalmente a notícias, fórum, calendário e notificações. | Alteração na entidade relacionada reflete nos canais configurados sem duplicação manual de conteúdo. | Briefing §§11 e 17 | 7 |
| RCF-002 | Manter contas financeiras, caixas, contas bancárias e centros de custo. | Lançamento aponta para conta e, quando exigido, centro de custo ativos; relatórios filtram ambos. | Briefing §8 | 3 |
| RCF-003 | Registrar transferência entre contas. | Transferência produz lados vinculados e de igual valor, sem alterar saldo agregado indevidamente. | Briefing §8 | 3 |
| RCF-004 | Controlar contas a pagar e a receber com competência, vencimento, pagamento e status. | Obrigação possui datas e situação coerentes; quitação gera/vincula movimentação sem duplicidade. | Briefing §§8 e 17 | 3 |
| RCF-005 | Tratar taxas, descontos, estornos e reembolsos com vínculos auditáveis. | Correção não reescreve histórico; estorno/reembolso referencia origem e tem sinal/tipo coerente. | Briefing §8 | 3–4 |
| RCF-006 | Reabrir fechamento de caixa somente com permissão específica. | Reabertura registra autor, instante e motivo, preservando o fechamento anterior no histórico. | Briefing §8 | 3 |
| RCF-007 | Suportar estoque tradicional, encomenda, campanha/remessa e produto de parceiro; produto digital fica futuro. | Cada modo ativo aplica regras próprias; modo digital não é disponibilizado sem fase aprovada. | Briefing §9 | 4–6 |
| RCF-008 | Manter imagens, marca, preço promocional, custo, SKU, variações, estoque mínimo, limite por comprador, disponibilidade, produção e retirada. | Campos configurados aparecem e são validados no contexto correto; preço/custo usam Decimal. | Briefing §9 | 4–5 |
| RCF-009 | Controlar mínimos/máximos, produção, envio à malharia, consolidação, chegada, retirada, cancelamento e reembolso de campanha. | Campanha impede venda fora das regras e gera relatório consolidado; políticas numéricas ainda exigem definição. | Briefing §9 | 5 |
| RCF-010 | Manter período, documentos, logo, contrato, comissão, repasse e relatório de parceiro. | Acesso a documentos é restrito; vendas permitem apurar receita do time e valor devido ao parceiro. | Briefing §10 | 6 |
| RCF-011 | Manter disponibilidade de profissional e permitir consulta antes do agendamento. | Horário confirmado não é duplicado e segue disponibilidade/fuso; regras de antecedência são provisórias. | Briefing §10 | 6 |
| RCF-012 | Permitir reações, denúncias, fixação, fechamento, visibilidade e histórico de moderação no fórum. | Ações respeitam permissão, são idempotentes quando aplicável e denúncias ficam restritas à moderação. | Briefing §11 | 7 |
| RCF-013 | Permitir categoria, resumo, slug, compartilhamento e publicação imediata/agendada de notícia. | Slug publicado é único; agendamento usa instante UTC e os canais exibem no momento configurado. | Briefing §11 | 7 |
| RCF-014 | Configurar história, favicon, capa, cores, PIX, dados bancários, termos, privacidade, regras e notificações do time. | Campo é editável sem deploy por autorizado e possui visibilidade pública/privada explícita. | Briefing §12 | 1–7 |
| RCF-015 | Verificar e-mail somente se a capacidade e sua fase forem aprovadas em `PEN-008`/`PEN-013`. | Quando implementado, o token é único, expira, não aparece em log e a verificação é idempotente. | Briefing §15 | Condicional |

## Estado de implementação

Atualizado em 19/10/2026. "Parcial" indica que a parte da fase entregue está implementada e o restante pertence a fase posterior.

| ID | Estado | Fase | Escopo entregue | Onde |
|---|---|---|---|---|
| RF-001 | implementado | 1, 4 | site institucional, CTAs, destaques da loja; notícias na Fase 7 | web `(site)/` |
| RF-002 | implementado | 2 | páginas e filtro por time | `/times`, `public/teams` |
| RF-003 | implementado | 2 | interessados com consentimento | `/interesse`, `public/interest` |
| RF-004 | implementado | 2 | seletivas e estados da inscrição | `/seletivas`, `tryouts` |
| RF-005 | implementado | 1 | cadastro livre; privilégios só por administrador | `auth/register`, `users` |
| RF-006 | implementado | 1 | login, logout, recuperação | `auth/*` |
| RF-007 | implementado | 1 | RBAC com permissões granulares | `access`, guard global |
| RF-008 | implementado | 2 | cadastro de atleta | `athletes` |
| RF-009 | implementado | 2 | edição com histórico | `athletes/:id`, auditoria |
| RF-010 | implementado | 2 | vínculos com equipes ao longo do tempo | `athletes/:id/memberships` |
| RF-011 | implementado | 3 | planos de mensalidade | `fee-plans` |
| RF-012 | implementado | 3 | geração mensal idempotente | `monthly-fees/generate` |
| RF-013 | implementado | 3 | pagamento manual/PIX, comprovante | `monthly-fees/:id/payments` |
| RF-014 | implementado | 3 | consulta com filtros | `monthly-fees` |
| RF-015 | implementado | 4 | cadastro de produtos | `store/products` |
| RF-016 | implementado | 4 | estoque por movimentações | `store/variants/:id/stock` |
| RF-017 | implementado | 4 | pedido de usuário ou visitante | `orders/checkout` |
| RF-018 | implementado | 4 | estados do pedido | `store/orders/:id/status` |
| RF-019 | parcial | 2–4 | área do atleta/cliente: dados, inscrições, mensalidades, pedidos, favoritos; agendamentos na Fase 6 | `/minha-conta` |
| RF-020 | implementado | 2–4 | atletas ativos, inscrições novas, mensalidades em aberto, saldo e vendas do mês | `dashboard/summary` |
| RF-021 | pendente | 8 | relatórios integrados e exportações | — |
| RF-022 | parcial | 2–5 | notificações internas de inscrição, cobrança, pedido e chegada; envio por e-mail real pendente | `me/notifications` |
| RF-023 | implementado | 1 | configurações públicas sem deploy | `team-settings` |
| RF-024 | parcial | 1–5 | auditoria em todos os módulos entregues; consulta disponível | `audit-logs` |
| RF-025 | implementado | 3 | Caixa com saldos derivados | `finance/summary` |
| RF-026 | implementado | 3 | lançamentos manuais | `finance/transactions` |
| RF-027 | implementado | 3 | categorias (plano provisório) | `finance/categories` |
| RF-028 | implementado | 3 | comprovantes fora do banco | `.../attachments` |
| RF-029 | implementado | 3–4 | entrada automática de mensalidade e pedido | pagamento confirmado |
| RF-030 | implementado | 3 | conciliação e fechamento | `finance/closings` |
| RF-031 | pendente | 6 | cadastro de parceiros | — |
| RF-032 | pendente | 6 | venda de parceiro com repasse | — |
| RF-033 | pendente | 6 | profissionais e serviços | — |
| RF-034 | pendente | 6 | agendamento | — |
| RF-035 | implementado | 4–5 | estoque, encomenda e remessa; digital reservado | produto `fulfillmentType` |
| RF-036 | implementado | 5 | controle de remessa | `campaigns` |
| RF-037 | implementado | 4 | carrinho no servidor | `cart` |
| RF-038 | implementado | 4 | favoritos | `me/favorites` |
| RF-039 | implementado | 1 | logos por contexto | `team-settings/brand-assets` |
| RF-040 | pendente | 7 | fórum | — |
| RF-041 | pendente | 7 | notícias | — |
| RF-042 | pendente | 7 | notícia em vários canais | — |
| RF-043 | pendente | 7 | moderação | — |
| RF-044 | implementado | 5 | aviso de chegada da remessa | remessa "pronta para retirada" |
| RF-045 | parcial | 3, 8 | resumo do Caixa por período, conta, categoria e origem; relatórios completos e exportação na Fase 8 | `finance/summary` |
| RCF-001 | pendente | 7 | eventos e partidas | — |
| RCF-002 | implementado | 3 | contas, centros de custo | `finance/accounts`, `cost-centers` |
| RCF-003 | implementado | 3 | transferência entre contas | `finance/transfers` |
| RCF-004 | implementado | 3 | contas a pagar e receber (sem recorrência) | `finance/obligations` |
| RCF-005 | implementado | 3–4 | estornos e reembolsos vinculados | estorno/reembolso |
| RCF-006 | implementado | 3 | reabertura com permissão | `closings/:id/reopen` |
| RCF-007 | parcial | 4–6 | estoque, encomenda e remessa; parceiro na Fase 6 | loja |
| RCF-008 | implementado | 4–5 | imagens, promoção, custo, SKU, variações, limites | loja |
| RCF-009 | implementado | 5 | mínimos, consolidação, chegada, cancelamento | `campaigns` |
| RCF-010 | pendente | 6 | documentos e repasses de parceiros | — |
| RCF-011 | pendente | 6 | disponibilidade de profissionais | — |
| RCF-012 | pendente | 7 | reações, denúncias e moderação | — |
| RCF-013 | pendente | 7 | notícias agendadas e slug | — |
| RCF-014 | parcial | 1–7 | história, cores, PIX, termos, regras; notificações configuráveis pendentes | `team-settings` |
| RCF-015 | pendente | condicional | verificação de e-mail (não bloqueante por decisão, `PEN-008`) | — |

## Rastreabilidade por módulo

| Módulo | Requisitos |
|---|---|
| Site/configurações | RF-001, RF-002, RF-023, RF-039, RCF-014 |
| Acesso/permissões | RF-005, RF-006, RF-007, RF-024, RCF-015 |
| Atletas/inscrições | RF-003, RF-004, RF-008, RF-009, RF-010, RF-019 |
| Mensalidades | RF-011, RF-012, RF-013, RF-014, RF-019, RF-022, RF-029 |
| Caixa Fênix | RF-025 a RF-030, RF-045, RCF-002 a RCF-006 |
| Loja/pedidos | RF-015 a RF-018, RF-032, RF-035 a RF-038, RCF-007, RCF-008 |
| Remessas | RF-035, RF-036, RF-044, RCF-009 |
| Parceiros/serviços | RF-031 a RF-034, RCF-010, RCF-011 |
| Comunicação | RF-040 a RF-043, RCF-001, RCF-012, RCF-013 |
| Relatórios/notificações/auditoria | RF-020 a RF-024, RF-045 |

## Questões provisórias que impedem aceite definitivo

- transições completas e responsáveis por cada estado;
- campos obrigatórios e regras de duplicidade;
- multas, descontos, pagamento parcial, competência e cancelamento de mensalidade;
- momento de reserva/baixa de estoque e validade de preços no carrinho;
- regras numéricas e política de reembolso de campanhas;
- agenda, cancelamento e acesso próprio de parceiro/profissional;
- categorias, visibilidade e política de moderação;
- conteúdo público versus restrito nas configurações;
- verificação de e-mail e integração de pagamentos em qual fase.
