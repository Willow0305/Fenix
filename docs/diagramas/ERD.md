# ERD — Fênix Vôlei

## Leitura

Os diagramas estão separados por domínio para permanecerem legíveis. Entidades repetidas são fronteiras compartilhadas, não tabelas duplicadas. Cardinalidades representam `prisma/schema.prisma`; campos, índices, nulabilidade, `onDelete` e constraints estão em `09-DICIONARIO-DE-DADOS.md`.

- `||`: exatamente um;
- `o|`: zero ou um;
- `|{`: um ou mais;
- `o{`: zero ou mais.

## 1. Identidade, configurações, arquivos e auditoria

```mermaid
erDiagram
    User ||--o{ UserSession : possui
    UserSession o|--o{ UserSession : rotaciona
    User ||--o{ UserToken : recebe
    User ||--o{ UserRole : assume
    Role ||--o{ UserRole : atribuido
    User o|--o{ UserRole : concede
    Role ||--o{ RolePermission : agrega
    Permission ||--o{ RolePermission : compoe
    User o|--o{ RolePermission : concede
    User o|--o{ TeamSettings : atualiza
    TeamSettings ||--o{ TeamBrandAsset : configura
    MediaFile ||--o{ TeamBrandAsset : representa
    User o|--o{ MediaFile : envia
    User o|--o{ AuditLog : executa

    User {
        uuid id PK
        string email UK
        string passwordHash
        enum status
    }
    UserSession {
        uuid id PK
        uuid userId FK
        string refreshTokenHash UK
        datetime expiresAt
    }
    UserToken {
        uuid id PK
        uuid userId FK
        string tokenHash UK
        enum type
    }
    Role {
        uuid id PK
        string code UK
    }
    Permission {
        uuid id PK
        string code UK
    }
    UserRole {
        uuid id PK
        uuid userId FK
        uuid roleId FK
    }
    RolePermission {
        uuid id PK
        uuid roleId FK
        uuid permissionId FK
    }
    TeamSettings {
        uuid id PK
        string singletonKey UK
        string defaultCurrency
        string timeZone
    }
    TeamBrandAsset {
        uuid id PK
        uuid teamSettingsId FK
        uuid mediaFileId FK
        enum context
    }
    MediaFile {
        uuid id PK
        string objectKey
        string checksumSha256
        enum classification
    }
    AuditLog {
        uuid id PK
        uuid actorUserId FK
        string action
        uuid entityId
    }
```

## 2. Atletas, equipes, interessados e inscrições

```mermaid
erDiagram
    User o|--o| Athlete : acessa
    User o|--o| InterestedPerson : identifica
    Athlete ||--o{ AthleteDocument : possui
    MediaFile ||--o{ AthleteDocument : armazena
    Category o|--o{ Team : classifica
    Athlete ||--o{ TeamAthlete : participa
    Team ||--o{ TeamAthlete : recebe
    User o|--o{ Registration : solicita
    InterestedPerson o|--o{ Registration : origina
    Athlete o|--o{ Registration : resulta
    Team o|--o{ Registration : pretendida
    Team o|--o{ Tryout : promove
    Event o|--o| Tryout : publica
    Tryout ||--o{ TryoutRegistration : recebe
    User o|--o{ TryoutRegistration : solicita
    Athlete o|--o{ TryoutRegistration : participa
    InterestedPerson o|--o{ TryoutRegistration : origina
    Athlete o|--o| InterestedPerson : converte

    Athlete {
        uuid id PK
        uuid userId FK
        string fullName
        date birthDate
        enum status
    }
    AthleteDocument {
        uuid id PK
        uuid athleteId FK
        uuid mediaFileId FK
        string documentType
    }
    Category {
        uuid id PK
        string slug UK
    }
    Team {
        uuid id PK
        uuid categoryId FK
        string slug UK
        enum type
    }
    TeamAthlete {
        uuid id PK
        uuid athleteId FK
        uuid teamId FK
        date startsOn
        date endsOn
    }
    InterestedPerson {
        uuid id PK
        uuid convertedAthleteId FK
        enum status
    }
    Registration {
        uuid id PK
        uuid interestedPersonId FK
        uuid resultingAthleteId FK
        enum status
    }
    Tryout {
        uuid id PK
        uuid teamId FK
        uuid eventId FK
        enum status
    }
    TryoutRegistration {
        uuid id PK
        uuid tryoutId FK
        uuid athleteId FK
        enum status
    }
```

## 3. Mensalidades e pagamentos

```mermaid
erDiagram
    Athlete ||--o{ AthleteMonthlyFeePlan : adere
    MonthlyFeePlan ||--o{ AthleteMonthlyFeePlan : aplicado
    Athlete ||--o{ MonthlyFee : recebe
    MonthlyFeePlan ||--o{ MonthlyFee : origina
    AthleteMonthlyFeePlan o|--o{ MonthlyFee : fundamenta
    MonthlyFee ||--o{ MonthlyFeePayment : aloca
    Payment ||--o{ MonthlyFeePayment : distribui
    PaymentMethod ||--o{ Payment : utilizado
    User o|--o{ Payment : paga
    Order o|--o{ Payment : recebe
    Payment ||--o{ Refund : reembolsa
    Order o|--o{ Refund : contextualiza

    MonthlyFeePlan {
        uuid id PK
        decimal amount
        string currency
        int dueDay
    }
    AthleteMonthlyFeePlan {
        uuid id PK
        uuid athleteId FK
        uuid monthlyFeePlanId FK
        date startsOn
    }
    MonthlyFee {
        uuid id PK
        uuid athleteId FK
        date referenceMonth
        decimal totalAmount
        enum status
    }
    MonthlyFeePayment {
        uuid id PK
        uuid monthlyFeeId FK
        uuid paymentId FK
        decimal allocatedAmount
    }
    PaymentMethod {
        uuid id PK
        string code UK
        enum type
    }
    Payment {
        uuid id PK
        uuid paymentMethodId FK
        uuid orderId FK
        decimal amount
        enum status
    }
    Refund {
        uuid id PK
        uuid paymentId FK
        decimal amount
        enum status
    }
```

## 4. Caixa Fênix

```mermaid
erDiagram
    FinancialCategory o|--o{ FinancialCategory : superior
    CostCenter o|--o{ CostCenter : superior
    FinancialCategory ||--o{ FinancialObligation : classifica
    CostCenter o|--o{ FinancialObligation : apropria
    Partner o|--o{ FinancialObligation : contraparte
    PaymentMethod o|--o{ FinancialObligation : metodo_previsto
    FinancialTransaction o|--o| FinancialObligation : liquida
    FinancialAccount ||--o{ FinancialTransaction : movimenta
    FinancialCategory ||--o{ FinancialTransaction : classifica
    CostCenter o|--o{ FinancialTransaction : apropria
    PaymentMethod o|--o{ FinancialTransaction : metodo_efetivo
    Payment o|--o| FinancialTransaction : gera
    Refund o|--o| FinancialTransaction : gera
    PartnerSettlement o|--o| FinancialTransaction : quita
    FinancialTransaction o|--o{ FinancialTransaction : reverte
    FinancialTransaction o|--o{ FinancialTransactionAttachment : comprova
    Payment o|--o{ FinancialTransactionAttachment : comprova
    MediaFile ||--o{ FinancialTransactionAttachment : armazena
    FinancialAccount ||--o{ CashClosing : fecha
    CashClosing o|--o{ FinancialTransaction : abrange
    FinancialAccount ||--o{ FinancialTransfer : origem
    FinancialAccount ||--o{ FinancialTransfer : destino
    FinancialTransaction ||--o| FinancialTransfer : perna_debito
    FinancialTransaction ||--o| FinancialTransfer : perna_credito

    FinancialAccount {
        uuid id PK
        string code UK
        enum type
        string currency
    }
    FinancialCategory {
        uuid id PK
        uuid parentId FK
        string code UK
        enum nature
    }
    CostCenter {
        uuid id PK
        uuid parentId FK
        string code UK
    }
    FinancialObligation {
        uuid id PK
        uuid categoryId FK
        uuid plannedPaymentMethodId FK
        uuid settlementTransactionId FK
        enum type
        enum status
        date competenceDate
        date dueDate
        decimal amount
    }
    FinancialTransaction {
        uuid id PK
        uuid accountId FK
        uuid categoryId FK
        uuid paymentMethodId FK
        decimal amount
        enum direction
        enum origin
        enum status
    }
    FinancialTransfer {
        uuid id PK
        uuid debitTransactionId FK
        uuid creditTransactionId FK
        decimal amount
    }
    FinancialTransactionAttachment {
        uuid id PK
        uuid financialTransactionId FK
        uuid paymentId FK
        uuid mediaFileId FK
    }
    CashClosing {
        uuid id PK
        uuid financialAccountId FK
        date periodStart
        date periodEnd
        decimal expectedBalance
    }
```

## 5. Loja, estoque e campanhas

```mermaid
erDiagram
    ProductCategory o|--o{ ProductCategory : superior
    ProductCategory ||--o{ Product : classifica
    Partner o|--o{ Product : fornece
    Product ||--o{ ProductImage : ilustra
    MediaFile ||--o{ ProductImage : armazena
    Product ||--o{ ProductVariant : varia
    ProductVariant ||--o{ InventoryMovement : movimenta
    OrderItem o|--o{ InventoryMovement : origina
    User ||--o{ Favorite : marca
    Product ||--o{ Favorite : favorito
    User o|--o{ Cart : possui
    Cart o|--o| Order : converte
    Cart ||--o{ CartItem : contem
    ProductVariant ||--o{ CartItem : seleciona
    SalesCampaignProduct o|--o{ CartItem : contextualiza
    User o|--o{ Order : compra
    Order ||--o{ OrderItem : contem
    Product ||--o{ OrderItem : registra
    ProductVariant ||--o{ OrderItem : registra
    Partner o|--o{ OrderItem : remunera
    SalesCampaignProduct o|--o{ OrderItem : contextualiza
    SalesCampaign ||--o{ SalesCampaignProduct : agrega
    Product ||--o{ SalesCampaignProduct : participa
    Partner o|--o{ SalesCampaign : fornece

    ProductCategory {
        uuid id PK
        uuid parentId FK
        string slug UK
    }
    Product {
        uuid id PK
        uuid productCategoryId FK
        uuid partnerId FK
        decimal basePrice
        enum fulfillmentType
    }
    ProductImage {
        uuid id PK
        uuid productId FK
        uuid mediaFileId FK
    }
    ProductVariant {
        uuid id PK
        uuid productId FK
        string sku UK
    }
    InventoryMovement {
        uuid id PK
        uuid productVariantId FK
        int quantityDelta
        enum type
    }
    SalesCampaign {
        uuid id PK
        uuid supplierPartnerId FK
        datetime salesStartAt
        datetime salesEndAt
        enum status
    }
    SalesCampaignProduct {
        uuid id PK
        uuid salesCampaignId FK
        uuid productId FK
    }
    Favorite {
        uuid id PK
        uuid userId FK
        uuid productId FK
    }
    Cart {
        uuid id PK
        uuid userId FK
        string guestKeyHash
        enum status
    }
    CartItem {
        uuid id PK
        uuid cartId FK
        uuid productVariantId FK
    }
    Order {
        uuid id PK
        string orderNumber UK
        decimal totalAmount
        enum status
    }
    OrderItem {
        uuid id PK
        uuid orderId FK
        uuid productVariantId FK
        decimal totalAmount
    }
```

## 6. Parceiros, serviços, agenda e repasses

```mermaid
erDiagram
    MediaFile o|--o{ Partner : identifica
    Partner ||--o{ PartnerDocument : documenta
    MediaFile ||--o{ PartnerDocument : armazena
    Partner ||--o{ PartnerProfessional : vincula
    User o|--o| PartnerProfessional : acessa
    Partner ||--o{ PartnerService : oferece
    PartnerProfessional o|--o{ PartnerService : executa
    PartnerProfessional ||--o{ ProfessionalAvailability : disponibiliza
    PartnerService o|--o{ ProfessionalAvailability : reserva_para
    PartnerService ||--o{ Appointment : solicitado
    PartnerProfessional o|--o{ Appointment : atende
    ProfessionalAvailability o|--o| Appointment : ocupa
    User ||--o{ Appointment : solicita
    Athlete o|--o{ Appointment : beneficiario
    Partner ||--o{ PartnerSettlement : recebe
    PartnerSettlement ||--o{ PartnerSettlementItem : compoe
    OrderItem ||--o| PartnerSettlementItem : apura

    Partner {
        uuid id PK
        uuid logoMediaFileId FK
        enum type
        enum status
        enum commissionType
    }
    PartnerDocument {
        uuid id PK
        uuid partnerId FK
        uuid mediaFileId FK
        string documentType
    }
    PartnerProfessional {
        uuid id PK
        uuid partnerId FK
        uuid userId FK
        string profession
    }
    PartnerService {
        uuid id PK
        uuid partnerId FK
        uuid professionalId FK
        decimal price
    }
    ProfessionalAvailability {
        uuid id PK
        uuid professionalId FK
        datetime startsAt
        datetime endsAt
    }
    Appointment {
        uuid id PK
        uuid partnerServiceId FK
        uuid availabilityId FK
        enum status
    }
    PartnerSettlement {
        uuid id PK
        uuid partnerId FK
        decimal netPayableAmount
        enum status
    }
    PartnerSettlementItem {
        uuid id PK
        uuid partnerSettlementId FK
        uuid orderItemId FK
        decimal netAmount
    }
```

## 7. Notícias, eventos, fórum e notificações

```mermaid
erDiagram
    NewsCategory ||--o{ News : classifica
    User o|--o{ News : escreve
    MediaFile o|--o{ News : cobre
    Event o|--o{ News : contextualiza
    ForumTopic o|--o| News : projeta
    Event ||--o| Match : detalha
    Team o|--o{ Match : representa
    ForumCategory ||--o{ ForumTopic : organiza
    User o|--o{ ForumTopic : cria
    ForumTopic ||--o{ ForumPost : contem
    User o|--o{ ForumPost : escreve
    ForumPost o|--o{ ForumPost : responde
    ForumPost ||--o{ ForumReaction : recebe
    User ||--o{ ForumReaction : reage
    ForumTopic o|--o{ ForumReport : denunciado
    ForumPost o|--o{ ForumReport : denunciado
    User ||--o{ ForumReport : denuncia
    ForumTopic o|--o{ ForumModerationAction : moderado
    ForumPost o|--o{ ForumModerationAction : moderado
    User ||--o{ ForumModerationAction : modera
    User ||--o{ Notification : recebe

    NewsCategory {
        uuid id PK
        string slug UK
    }
    News {
        uuid id PK
        uuid categoryId FK
        uuid eventId FK
        uuid forumTopicId FK
        string slug UK
        enum status
    }
    Event {
        uuid id PK
        string slug UK
        enum type
        enum status
    }
    Match {
        uuid id PK
        uuid eventId FK
        uuid teamId FK
        string opponentName
    }
    ForumCategory {
        uuid id PK
        string slug UK
        enum visibility
    }
    ForumTopic {
        uuid id PK
        uuid categoryId FK
        enum status
        enum visibility
    }
    ForumPost {
        uuid id PK
        uuid topicId FK
        uuid parentPostId FK
        enum status
    }
    ForumReaction {
        uuid id PK
        uuid postId FK
        uuid userId FK
        enum type
    }
    ForumReport {
        uuid id PK
        uuid topicId FK
        uuid postId FK
        enum status
    }
    ForumModerationAction {
        uuid id PK
        uuid topicId FK
        uuid postId FK
        enum action
    }
    Notification {
        uuid id PK
        uuid userId FK
        enum channel
        enum deliveryStatus
    }
```

## 8. Restrições complementares

- `Cart`: exatamente um entre `userId` e `guestKeyHash`.
- `ForumReport` e `ForumModerationAction`: exatamente um entre `topicId` e `postId`.
- `FinancialObligation`: `SETTLED` exige `settlementTransactionId` e `settledAt`; obrigação aberta não compõe saldo.
- `PaymentMethod`: obrigação pode indicar o método previsto e movimentação registra o método efetivo; uma origem `Payment` mantém método e moeda coerentes.
- `FinancialTransfer`: contas e pernas distintas, com o mesmo valor/moeda e sentidos opostos.
- `FinancialTransaction`: a FK de origem automática corresponde ao enum `origin`; uma movimentação não tem duas origens automáticas.
- `CashClosing`: movimentações abrangidas pertencem à mesma conta e moeda e ocorrem dentro do período fechado.
- Loja/estoque: produto, variante e produto de campanha de carrinho/pedido são coerentes; movimento originado por item usa a mesma variante.
- Reembolso/repasse: pedido do reembolso corresponde ao pedido do pagamento; parceiro do item corresponde ao parceiro do repasse.
- `Appointment`: `availabilityId` é único quando preenchido; política futura de recorrência/sobreposição exige constraint adicional.
- `Match` e `Tryout`: no máximo um detalhe por `Event` e nunca ambos; `TRYOUT` usa evento do tipo `TRYOUT`, enquanto `Match` usa `MATCH` ou `FRIENDLY`. Quando a seletiva tem evento, agenda/local vêm de `Event` e os campos de fallback em `Tryout` ficam nulos.
- Registros financeiros confirmados, pagamentos, repasses, fechamentos, auditoria e moderação não sofrem exclusão destrutiva.
