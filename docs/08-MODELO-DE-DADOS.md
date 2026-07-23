# Modelo de dados

## 1. Estado e escopo

Este documento define o modelo conceitual e lógico inicial do Fênix Vôlei. Ele é um artefato de planejamento da Fase 0: descreve o banco-alvo das fases 1 a 8, mas não declara módulos funcionais implementados, não cria migrations e não autoriza antecipar o roadmap.

O modelo consolida o PDF de requisitos, o briefing técnico, `AGENTS.md` e as decisões vigentes em `17-DECISOES-TECNICAS.md`. O contrato físico de referência está em `prisma/schema.prisma`; detalhes de campos e restrições estão em `09-DICIONARIO-DE-DADOS.md`.

## 2. Convenções vinculantes

- PostgreSQL é a fonte transacional de verdade e Prisma é o ORM.
- Toda tabela, inclusive associação com identidade, possui `id UUID`.
- Instantes usam `TIMESTAMPTZ` e são tratados como UTC; datas civis usam `DATE`.
- Dinheiro usa provisoriamente `Decimal(19,4)`/`NUMERIC(19,4)` e código ISO 4217 em `CHAR(3)`. Moeda operacional, escala de exibição e arredondamento continuam pendentes; nenhum caso de uso deve inferi-los do tipo físico.
- Percentuais usam `Decimal(7,4)` quando representam taxa e nunca `float`/`double`.
- Entidades mutáveis possuem `createdAt` e `updatedAt`; agregados importantes também possuem `deletedAt`.
- Exclusão lógica não substitui retenção, anonimização ou obrigação legal definida pela LGPD.
- Toda relação Prisma declara `onDelete`; dependentes descartáveis usam `Cascade`, histórico usa `Restrict` e autoria opcional usa `SetNull`.
- Arquivos não são binários do banco. `MediaFile` guarda provedor, bucket, chave do objeto, MIME real, tamanho e hash de integridade.
- Valores derivados, como saldo, estoque disponível, total pago e dívida do parceiro, não são fontes editáveis.

## 3. Domínios e agregados

| Domínio | Agregados e entidades |
|---|---|
| Identidade e acesso | `User`, `UserSession`, `UserToken`, `Role`, `Permission`, `UserRole`, `RolePermission` |
| Configurações e arquivos | `TeamSettings`, `TeamBrandAsset`, `MediaFile`, `AuditLog` |
| Esportivo e inscrições | `Athlete`, `AthleteDocument`, `Category`, `Team`, `TeamAthlete`, `InterestedPerson`, `Registration`, `Tryout`, `TryoutRegistration` |
| Mensalidades | `MonthlyFeePlan`, `AthleteMonthlyFeePlan`, `MonthlyFee`, `MonthlyFeePayment` |
| Caixa Fênix | `FinancialAccount`, `FinancialCategory`, `CostCenter`, `FinancialObligation`, `FinancialTransaction`, `FinancialTransfer`, `FinancialTransactionAttachment`, `CashClosing`, `PaymentMethod` |
| Loja e estoque | `ProductCategory`, `Product`, `ProductImage`, `ProductVariant`, `InventoryMovement`, `Favorite`, `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment`, `Refund` |
| Campanhas | `SalesCampaign`, `SalesCampaignProduct` |
| Parceiros e agenda | `Partner`, `PartnerDocument`, `PartnerProfessional`, `PartnerService`, `ProfessionalAvailability`, `Appointment`, `PartnerSettlement`, `PartnerSettlementItem` |
| Conteúdo e comunidade | `NewsCategory`, `News`, `Event`, `Match`, `ForumCategory`, `ForumTopic`, `ForumPost`, `ForumReaction`, `ForumReport`, `ForumModerationAction`, `Notification` |

## 4. Entidades de apoio justificadas

O briefing exige todas as entidades principais acima, salvo as seguintes divisões de apoio necessárias para expressar requisitos sem campos polimórficos ou histórico destrutivo:

| Entidade adicionada | Justificativa |
|---|---|
| `UserSession` | Guarda somente hash do refresh token, expiração, rotação e revogação, conforme DT-012. |
| `UserToken` | Representa token de uso único para recuperação de senha ou verificação de e-mail sem armazenar o segredo em claro. |
| `TeamBrandAsset` | Normaliza logo oficial, masculino, feminino, diretoria, favicon e capa e permite novos contextos sem novas colunas. |
| `MonthlyFeePlan` | O plano, valor e dia de vencimento são requisito de RF-011, mas não constavam na lista mínima de entidades. |
| `AthleteMonthlyFeePlan` | Preserva o histórico temporal do plano aplicado ao atleta sem reescrever cobranças antigas. |
| `FinancialObligation` | Separa contas a pagar/receber ainda não liquidadas das movimentações que efetivamente compõem saldo, atendendo RCF-004. |
| `FinancialTransfer` | Vincula de forma inequívoca as duas movimentações de igual valor de uma transferência entre contas. |
| `PartnerDocument` | Vincula contratos e documentos do parceiro a `MediaFile`, sem binário nem URL pública permanente. |
| `PartnerSettlementItem` | Congela a composição de cada repasse por item de pedido e permite auditoria do valor devido ao parceiro. |
| `ForumModerationAction` | Mantém histórico imutável de ocultação, restauração, fechamento e outras ações de moderação. |
| `NewsCategory` | Atende a categoria editorial de notícia sem confundi-la com categoria esportiva ou do fórum. |

Não foram criados prontuário, avaliação clínica, dado de saúde, produto digital ativo, marketplace aberto ou saldo editável.

## 5. Decisões de modelagem

### 5.1 Identidade, RBAC e sessões

`Role` e `Permission` formam RBAC N:N por `RolePermission`; usuários recebem múltiplos papéis por `UserRole`. As associações têm UUID, autoria da concessão e unicidade do par. Autorização continua sendo validada no servidor.

Senha é representada apenas por hash adaptativo em `User.passwordHash`. Refresh tokens e tokens de recuperação/verificação também são persistidos somente como hash. Revogação e rotação preservam evidência sem registrar o token utilizável.

### 5.2 Atletas, equipes e inscrições

`Athlete` pode, mas não precisa, estar ligado a `User`; administradores não são atletas e um cadastro esportivo pode existir antes de uma conta. `TeamAthlete` preserva vínculos N:N e períodos históricos. `Category` representa categoria esportiva, enquanto `Team` representa a equipe operacional.

`InterestedPerson` é uma manifestação inicial de interesse. `Registration` é uma inscrição geral no time e `TryoutRegistration` é uma inscrição em seletiva específica. Ambas preservam o retrato cadastral submetido; a conversão opcional para `Athlete` não apaga a origem.

Campos obrigatórios exatos, deduplicação de candidatos e vínculo de responsável por menor continuam dependentes de decisão de negócio. O schema aceita os dados mínimos explicitamente pedidos sem conceder acesso de responsável.

### 5.3 Mensalidades e pagamentos

`MonthlyFeePlan` define preço e vencimento vigentes. `AthleteMonthlyFeePlan` registra sua aplicação temporal. `MonthlyFee` congela competência, vencimento e valores da cobrança para que alterações futuras no plano não alterem histórico.

`Payment` é o fato de pagamento reutilizável. Um pedido o referencia diretamente; uma mensalidade o aloca por `MonthlyFeePayment`, permitindo pagamentos parciais, múltiplos métodos ou um pagamento distribuído sem criar duas fontes de verdade. Regras de multa, juros, desconto e tolerância permanecem pendentes.

### 5.4 Caixa Fênix

`FinancialObligation` representa conta a pagar ou a receber, com competência, vencimento, favorecido/contraparte, valor e estado. Enquanto não liquidada, ela integra pendências e fluxo previsto, mas não o saldo. Sua liquidação opcional aponta para uma `FinancialTransaction` confirmada.

`PaymentMethod` é o catálogo comum das formas de pagamento. A obrigação pode registrar um método previsto por `plannedPaymentMethodId`; a movimentação registra o método efetivamente usado por `paymentMethodId`. Quando a movimentação deriva de `Payment`, o método efetivo precisa ser o mesmo do pagamento. Alterar o método previsto não reescreve uma liquidação já confirmada.

`FinancialTransaction` é uma movimentação de uma única conta, em uma única direção e moeda. Uma entrada confirmada aumenta o saldo derivado; uma saída confirmada o reduz. Não existe coluna de saldo em `FinancialAccount`.

Origens automáticas são explicitadas por relações opcionais e exclusivas com `Payment`, `Refund` ou `PartnerSettlement`. Lançamentos manuais e ajustes usam origem enumerada, autoria e chave de idempotência. Uma reversão aponta para a movimentação original; nunca altera seu valor.

`FinancialTransfer` aponta para a movimentação de saída na conta de origem e a movimentação de entrada na conta de destino. Ambas devem ter mesmo valor, moeda, estado confirmado e identificador de transferência. Essa invariante exige transação de banco e `CHECK`/trigger ou validação equivalente na migration.

`CashClosing` registra período, saldo esperado, saldo contado e diferença. Reabertura altera o estado do mesmo fechamento, exige permissão e motivo e gera `AuditLog`; não remove o fechamento anterior. Conciliação individual fica em `FinancialTransaction.reconciledAt`, `reconciledById` e `statementReference`.

`FinancialTransactionAttachment` pode referenciar o pagamento, a movimentação resultante ou ambos, sempre por um único `MediaFile`. Assim, um comprovante recebido antes da confirmação não perde rastreabilidade quando a entrada financeira é criada.

### 5.5 Loja, campanhas, estoque e parceiros

O modelo separa dois conceitos:

- `Product.fulfillmentType`: estoque, encomenda, campanha ou digital reservado;
- `Product.partnerId`: origem própria quando nulo ou produto de parceiro quando preenchido.

Assim, um produto parceiro também pode ter estoque ou participar de campanha. `DIGITAL` é somente um valor reservado para compatibilidade futura: produtos ativos não podem usá-lo antes de requisito detalhado e fase aprovada.

Todo item vendável possui `ProductVariant`, inclusive uma variante padrão quando não há tamanho/cor. SKU, preço opcional e atributos pertencem à variante. O estoque é a soma dos efeitos de `InventoryMovement`; não há quantidade editável no produto. A definição exata de reserva, baixa e liberação será fechada na Fase 4.

`SalesCampaignProduct` resolve a relação N:N entre campanha/remessa e produto e pode fixar preço e limites no contexto. `OrderItem` guarda snapshots de nome, SKU, preço, moeda, parceiro e comissão para que alterações de catálogo não modifiquem pedidos concluídos.

`PartnerSettlement` agrega o repasse de um período. Seus `PartnerSettlementItem` registram valores bruto, comissão e líquido por item. O pagamento do repasse gera saída financeira explicitamente ligada; nenhum “saldo do parceiro” é armazenado.

As referências redundantes usadas para preservar snapshots precisam ser coerentes: produto e variante de `OrderItem` pertencem ao mesmo agregado; o produto de campanha em carrinho/pedido corresponde ao produto da variante/item; um movimento originado por item usa a mesma variante; e todo item de repasse pertence ao parceiro do cabeçalho. Essas regras exigem validação transacional e constraints/trigger revisados na migration.

### 5.6 Agenda

`ProfessionalAvailability` representa intervalo disponível ou bloqueado em UTC. `Appointment` guarda o pedido, eventual slot, serviço, profissional atribuído e intervalo confirmado. A restrição única sobre `availabilityId` evita dupla ocupação de um slot discreto. Recorrência, antecedência, capacidade e política de cancelamento não são presumidas.

Observações de agendamento são administrativas; prontuário, diagnóstico, sintomas e outros dados de saúde não pertencem a este modelo.

### 5.7 Conteúdo, eventos e comunidade

`Event` concentra data, local e visibilidade quando existe uma projeção de calendário. `Match` é seu detalhe opcional 1:1. `Tryout` pode existir internamente sem evento e, nesse caso, usa seus próprios `startsAt` e `location`; quando `eventId` existe, esses dois campos de fallback ficam nulos e a agenda/local são lidos de `Event`. Evento ligado a seletiva usa tipo `TRYOUT`; evento ligado a partida usa `MATCH` ou `FRIENDLY`; o mesmo evento não pode conter simultaneamente `Match` e `Tryout`. `News` liga-se opcionalmente a `Event` e `ForumTopic`, permitindo projeção em página inicial, calendário e fórum sem cópia manual.

`ForumPost` representa publicação inicial ou resposta por autor e aceita `parentPostId` para comentários encadeados. Reações pertencem a posts. `ForumReport` denuncia exatamente um tópico ou post, e `ForumModerationAction` registra a atuação correspondente.

## 6. Invariantes transversais

1. Preços, cobranças, pagamentos, reembolsos, obrigações e movimentações efetivas são não negativos e, quando representam um fato confirmado, devem ser maiores que zero. Campos explicitamente assinados — como diferença de fechamento e ajuste de repasse — podem ser negativos; saldo calculado também pode ser negativo quando a política da conta permitir. A escala de armazenamento não define escala comercial ou regra de arredondamento.
2. Cada moeda usa três letras maiúsculas e valores combinados precisam ter a mesma moeda.
3. Datas finais não antecedem datas iniciais; intervalos de venda, disponibilidade e fechamento são válidos.
4. Um carrinho pertence exatamente a um usuário ou a uma chave anônima com hash, nunca aos dois.
5. Um `ForumReport` e uma `ForumModerationAction` apontam para exatamente um alvo.
6. Uma origem automática de `FinancialTransaction` corresponde à FK exigida pelo seu `origin`.
7. Pagamento confirmado de mensalidade/pedido vincula exatamente uma entrada financeira idempotente.
8. Reembolso concluído vincula uma saída e nunca supera o total confirmado ainda não reembolsado.
9. Registros financeiros confirmados, pagamentos, fechamentos, auditoria e composição de repasse são imutáveis por exclusão.
10. Campos de snapshot de pedido e cobrança não são recalculados retroativamente.
11. Identificadores públicos (`slug`, `orderNumber`) e chaves de idempotência são únicos.
12. Consultas normais ignoram `deletedAt`, mas auditoria e retenção autorizada ainda podem acessar o histórico.
13. `OrderItem.productId` corresponde ao produto da variante; referências de campanha em `CartItem` e `OrderItem` pertencem ao mesmo produto selecionado.
14. `InventoryMovement.orderItemId`, quando presente, referencia um item com a mesma variante; `PartnerSettlementItem` referencia item do mesmo parceiro do repasse.
15. `Refund.orderId`, quando presente, corresponde ao pedido do `Payment`; moedas e forma de pagamento de fatos derivados permanecem coerentes com sua origem.
16. `Tryout` e `Event` obedecem à autoridade de agenda/local e à compatibilidade de tipo descritas na seção 5.7.
17. Uma movimentação ligada a `CashClosing` pertence à mesma conta e moeda e seu `occurredAt` está dentro do período fechado.

As invariantes que Prisma não expressa serão adicionadas em migrations SQL revisadas na fase de implementação. Até lá, o schema é um contrato lógico e não substitui essas constraints.

## 7. Exclusão e retenção

| Política | Entidades típicas |
|---|---|
| Exclusão lógica | usuário, papel, permissão, atleta, equipe, inscrições, planos, contas/categorias, parceiros, catálogo, conteúdo e mídia |
| Somente cancelamento/estorno | mensalidade emitida, pedido confirmado, pagamento, reembolso, movimentação financeira, transferência, repasse e fechamento |
| Exclusão física de dependente transitório | sessão expirada após retenção, token consumido, item de carrinho e favorito |
| Append-only | `AuditLog` e `ForumModerationAction`; alterações são novos eventos |

Pedidos e registros financeiros podem ter `deletedAt` somente para rascunhos ou registros ainda não confirmados; a aplicação deve impedir exclusão lógica depois do marco de imutabilidade. Políticas legais de retenção, anonimização e atendimento ao titular ainda precisam ser aprovadas.

## 8. Auditoria e privacidade

- Operações sensíveis geram `AuditLog` com autor, instante, ação, entidade, motivo e valores anterior/novo minimizados.
- `AuditLog` não recebe senha, token, comprovante, documento integral nem payload pessoal completo.
- CPF/documento e registro profissional, quando necessários, usam conteúdo cifrado e hash cego normalizado para busca/duplicidade; detalhes criptográficos dependem da Fase 1/2.
- Chave PIX e dados bancários institucionais são armazenados cifrados e nunca publicados por leitura genérica de configurações.
- `MediaFile.classification` controla acesso público, interno, confidencial ou sensível.
- IP de auditoria é opcional e deve ser minimizado/hasheado conforme política de retenção.

## 9. Índices e constraints físicos

O schema Prisma declara PKs, FKs, unicidades e índices portáveis. A primeira migration de cada módulo deverá complementar:

- `CHECK` para valores, percentuais, moedas e coerência temporal;
- `CHECK` de alvo/origem exclusiva em carrinho, denúncia, moderação e movimentação financeira;
- índices únicos parciais que desconsiderem `deletedAt`, quando a regra exigir reutilização;
- bloqueio de `UPDATE`/`DELETE` destrutivo em fatos financeiros confirmados;
- validação das duas pernas da transferência;
- coerência entre método previsto da obrigação, método efetivo da movimentação e método de `Payment` quando houver origem automática;
- coerência cruzada de produto/variante/campanha, variante/movimento, parceiro/repasse e pedido/reembolso;
- coerência de conta, moeda e período entre `CashClosing` e cada movimentação abrangida;
- autoridade de agenda/local e exclusividade/compatibilidade de tipo entre `Event`, `Tryout` e `Match`;
- prevenção concorrente de sobreposição de agenda conforme a política aprovada;
- índices de busca textual somente quando consultas reais justificarem.

Não existe migration nesta entrega.

## 10. Rastreabilidade e evolução

O modelo cobre os requisitos canônicos RF-003 a RF-045 relacionados a persistência e os complementos RCF-001 a RCF-015. A implementação deve ativar tabelas apenas na fase correspondente do roadmap. Mudanças estruturais posteriores precisam atualizar, no mesmo conjunto de mudanças, este documento, o dicionário, o ERD, o schema e `17-DECISOES-TECNICAS.md` quando configurarem decisão arquitetural.
