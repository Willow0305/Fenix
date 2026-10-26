# Dicionário de dados

> **Atualizações após a baseline (fases 2 e 4):**
>
> - `athletes.guardian_acknowledged_at` (`TIMESTAMPTZ`, opcional): instante da confirmação de ciência do responsável para atleta menor de 12 anos (`DT-026`).
> - `interested_people.guardian_name`, `guardian_phone` e `tryout_registrations.guardian_name`, `guardian_phone`, `privacy_notice_version`, `consent_at`: responsável de menor e prova do consentimento ao aviso de privacidade.
> - `orders.guest_access_token_hash` (`CHAR(64)`, único, opcional): SHA-256 do código de consulta do visitante; o código nunca é armazenado em claro.
> - `orders.reservation_expires_at` (`TIMESTAMPTZ`, opcional): fim da reserva de estoque de pedido não pago; nulo enquanto há comprovante em análise. Índice `(status, reservation_expires_at)`.

## 1. Escopo e notação

Este dicionário descreve o schema lógico inicial. Ele não é migration nem autoriza implementar os módulos antes de sua fase. Nomes apresentados são os nomes Prisma; `@@map` e `@map` os convertem para `snake_case` no PostgreSQL.

Convenções:

- `O`: obrigatório;
- `P`: opcional/nulo;
- `PK`: chave primária;
- `FK`: chave estrangeira;
- `UK`: unicidade;
- `IX`: índice não único;
- `R`: `ON DELETE RESTRICT`;
- `C`: `ON DELETE CASCADE`;
- `N`: `ON DELETE SET NULL`.

Salvo indicação explícita, toda tabela possui `id: UUID` obrigatório como PK, gerado na aplicação/Prisma, e `createdAt: TIMESTAMPTZ` com instante UTC. Os grupos de campos comuns são:

| Grupo | Campos |
|---|---|
| `M` — cadastro mutável | `createdAt: TIMESTAMPTZ` (O), `updatedAt: TIMESTAMPTZ` (O), `deletedAt: TIMESTAMPTZ` (P) |
| `H` — histórico com transição | `createdAt: TIMESTAMPTZ` (O), `updatedAt: TIMESTAMPTZ` (O); sem exclusão pela aplicação após confirmação |
| `A` — append-only | `createdAt: TIMESTAMPTZ` (O); não permite update/delete funcional |
| `T` — transitório | `createdAt: TIMESTAMPTZ` (O), `updatedAt: TIMESTAMPTZ` (O); exclusão física somente por rotina de retenção |

Tipos e regras transversais:

- dinheiro: `DECIMAL(19,4)` provisório, acompanhado de `currency: CHAR(3)`; escala de exibição e arredondamento são decisões pendentes;
- percentual: `DECIMAL(7,4)` provisório;
- data civil: `DATE`;
- instante: `TIMESTAMPTZ`, recebido e devolvido em UTC;
- texto curto: `VARCHAR(n)` com limite indicado no schema;
- payload flexível: `JSONB`, validado por schema de aplicação e nunca usado para substituir relações centrais;
- arquivo: somente metadados e chave privada; nenhum binário;
- exclusão lógica: consultas comuns exigem `deletedAt IS NULL`;
- toda FK possui política explícita; constraints que o Prisma não representa serão adicionadas em migration SQL.

## 2. Catálogo de enums

| Enum | Valores |
|---|---|
| `UserStatus` | `PENDING`, `ACTIVE`, `INACTIVE`, `BLOCKED` |
| `UserTokenType` | `PASSWORD_RESET`, `EMAIL_VERIFICATION` |
| `MediaKind` | `IMAGE`, `DOCUMENT`, `RECEIPT`, `INVOICE`, `CONTRACT`, `OTHER` |
| `DataClassification` | `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `SENSITIVE` |
| `TeamBrandContext` | `OFFICIAL`, `MALE`, `FEMALE`, `BOARD`, `FAVICON`, `COVER`, `OTHER` |
| `AthleteStatus` | `PENDING`, `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `Gender` | `MALE`, `FEMALE`, `NON_BINARY`, `OTHER`, `NOT_INFORMED` |
| `TeamType` | `MALE`, `FEMALE`, `MIXED`, `OTHER` |
| `TeamMembershipStatus` | `ACTIVE`, `INACTIVE` |
| `TryoutStatus` | `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, `COMPLETED`, `CANCELLED` |
| `TryoutRegistrationStatus` | `NEW`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `ATTENDED`, `NO_SHOW`, `CANCELLED` |
| `InterestedPersonStatus` | `NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `ARCHIVED` |
| `MonthlyFeePlanStatus` | `ACTIVE`, `INACTIVE` |
| `AthletePlanStatus` | `ACTIVE`, `ENDED`, `CANCELLED` |
| `MonthlyFeeStatus` | `OPEN`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED` |
| `PaymentMethodType` | `PIX`, `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `BOLETO`, `OTHER` |
| `PaymentStatus` | `PENDING`, `PROCESSING`, `CONFIRMED`, `FAILED`, `CANCELLED`, `PARTIALLY_REFUNDED`, `REFUNDED` |
| `RefundStatus` | `REQUESTED`, `APPROVED`, `PROCESSING`, `COMPLETED`, `REJECTED`, `CANCELLED` |
| `FinancialAccountType` | `CASH`, `BANK`, `PIX`, `WALLET`, `CARD_CLEARING`, `OTHER` |
| `FinancialCategoryNature` | `INCOME`, `EXPENSE`, `TRANSFER` |
| `FinancialObligationType` | `PAYABLE`, `RECEIVABLE` |
| `FinancialObligationStatus` | `OPEN`, `SETTLED`, `OVERDUE`, `CANCELLED` |
| `FinancialDirection` | `INCOME`, `EXPENSE` |
| `FinancialOrigin` | `MANUAL`, `MONTHLY_FEE`, `ORDER`, `REFUND`, `PARTNER_SETTLEMENT`, `TRANSFER`, `OPENING_BALANCE`, `ADJUSTMENT` |
| `FinancialTransactionStatus` | `DRAFT`, `PENDING`, `CONFIRMED`, `CANCELLED` |
| `FinancialAttachmentType` | `RECEIPT`, `INVOICE`, `CONTRACT`, `OTHER` |
| `CashClosingStatus` | `DRAFT`, `CLOSED`, `REOPENED` |
| `PartnerType` | `SUPPLIER`, `STORE`, `PROFESSIONAL`, `SPONSOR`, `OTHER` |
| `PartnerStatus` | `PENDING`, `ACTIVE`, `INACTIVE`, `ENDED` |
| `ProfessionalStatus` | `ACTIVE`, `INACTIVE` |
| `CommissionType` | `NONE`, `PERCENTAGE`, `FIXED` |
| `ServiceStatus` | `DRAFT`, `ACTIVE`, `INACTIVE` |
| `AvailabilityStatus` | `AVAILABLE`, `BLOCKED`, `RESERVED` |
| `AppointmentStatus` | `REQUESTED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `ProductFulfillmentType` | `STOCK`, `MADE_TO_ORDER`, `CAMPAIGN`, `DIGITAL` reservado e proibido para produto ativo no escopo vigente |
| `ProductStatus` | `DRAFT`, `ACTIVE`, `INACTIVE`, `SOLD_OUT`, `ARCHIVED` |
| `InventoryMovementType` | `STOCK_IN`, `STOCK_OUT`, `RESERVATION`, `RELEASE`, `ADJUSTMENT`, `RETURN`, `LOSS` |
| `SalesCampaignStatus` | `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, `ORDERED`, `IN_PRODUCTION`, `RECEIVED`, `READY_FOR_PICKUP`, `COMPLETED`, `CANCELLED` |
| `CartStatus` | `ACTIVE`, `CONVERTED`, `ABANDONED`, `EXPIRED` |
| `OrderStatus` | `CREATED`, `AWAITING_PAYMENT`, `PAID`, `PROCESSING`, `READY_FOR_PICKUP`, `DELIVERED`, `CANCELLED`, `REFUNDED` |
| `PartnerSettlementStatus` | `DRAFT`, `PENDING`, `APPROVED`, `PAID`, `CANCELLED` |
| `ForumVisibility` | `PUBLIC`, `MEMBERS`, `STAFF` |
| `ForumTopicStatus` | `DRAFT`, `PUBLISHED`, `CLOSED`, `HIDDEN`, `ARCHIVED` |
| `ForumPostStatus` | `PUBLISHED`, `HIDDEN`, `DELETED` |
| `ForumReactionType` | `LIKE`, `SUPPORT`, `CELEBRATE` |
| `ForumReportStatus` | `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `DISMISSED` |
| `ModerationActionType` | `HIDE`, `RESTORE`, `CLOSE`, `REOPEN`, `DELETE`, `EDIT` |
| `NewsStatus` | `DRAFT`, `SCHEDULED`, `PUBLISHED`, `HIDDEN`, `ARCHIVED` |
| `EventType` | `TRYOUT`, `MATCH`, `FRIENDLY`, `TRAINING`, `COMMUNITY`, `OTHER` |
| `EventStatus` | `DRAFT`, `SCHEDULED`, `CANCELLED`, `COMPLETED` |
| `NotificationChannel` | `IN_APP`, `EMAIL` |
| `NotificationDeliveryStatus` | `PENDING`, `SENT`, `FAILED`, `CANCELLED` |

Mapeamento completo dos campos enumerados:

| Campo | Enum |
|---|---|
| `User.status` | `UserStatus` |
| `UserToken.type` | `UserTokenType` |
| `TeamBrandAsset.context` | `TeamBrandContext` |
| `MediaFile.kind` | `MediaKind` |
| `MediaFile.classification` | `DataClassification` |
| `Athlete.gender` | `Gender` |
| `Athlete.status` | `AthleteStatus` |
| `Team.type` | `TeamType` |
| `TeamAthlete.status` | `TeamMembershipStatus` |
| `InterestedPerson.status` | `InterestedPersonStatus` |
| `Tryout.status` | `TryoutStatus` |
| `TryoutRegistration.gender` | `Gender` |
| `TryoutRegistration.status` | `TryoutRegistrationStatus` |
| `MonthlyFeePlan.status` | `MonthlyFeePlanStatus` |
| `AthleteMonthlyFeePlan.status` | `AthletePlanStatus` |
| `MonthlyFee.status` | `MonthlyFeeStatus` |
| `PaymentMethod.type` | `PaymentMethodType` |
| `Payment.status` | `PaymentStatus` |
| `Refund.status` | `RefundStatus` |
| `FinancialAccount.type` | `FinancialAccountType` |
| `FinancialCategory.nature` | `FinancialCategoryNature` |
| `FinancialObligation.type` | `FinancialObligationType` |
| `FinancialObligation.status` | `FinancialObligationStatus` |
| `FinancialTransaction.direction` | `FinancialDirection` |
| `FinancialTransaction.origin` | `FinancialOrigin` |
| `FinancialTransaction.status` | `FinancialTransactionStatus` |
| `FinancialTransactionAttachment.type` | `FinancialAttachmentType` |
| `CashClosing.status` | `CashClosingStatus` |
| `Product.fulfillmentType` | `ProductFulfillmentType` |
| `Product.status` | `ProductStatus` |
| `Product.commissionTypeOverride` | `CommissionType` |
| `ProductVariant.gender` | `Gender` |
| `InventoryMovement.type` | `InventoryMovementType` |
| `SalesCampaign.status` | `SalesCampaignStatus` |
| `Cart.status` | `CartStatus` |
| `Order.status` | `OrderStatus` |
| `OrderItem.commissionTypeSnapshot` | `CommissionType` |
| `Partner.type` | `PartnerType` |
| `Partner.status` | `PartnerStatus` |
| `Partner.commissionType` | `CommissionType` |
| `PartnerProfessional.status` | `ProfessionalStatus` |
| `PartnerService.status` | `ServiceStatus` |
| `ProfessionalAvailability.status` | `AvailabilityStatus` |
| `Appointment.status` | `AppointmentStatus` |
| `PartnerSettlement.status` | `PartnerSettlementStatus` |
| `Event.type` | `EventType` |
| `Event.status` | `EventStatus` |
| `ForumCategory.visibility` | `ForumVisibility` |
| `ForumTopic.visibility` | `ForumVisibility` |
| `ForumTopic.status` | `ForumTopicStatus` |
| `ForumPost.status` | `ForumPostStatus` |
| `ForumReaction.type` | `ForumReactionType` |
| `ForumReport.status` | `ForumReportStatus` |
| `ForumModerationAction.action` | `ModerationActionType` |
| `News.status` | `NewsStatus` |
| `Notification.channel` | `NotificationChannel` |
| `Notification.deliveryStatus` | `NotificationDeliveryStatus` |

Enums de estados descrevem o vocabulário inicial; transições e responsáveis dependem das regras da fase correspondente.

## 3. Identidade, acesso, configurações e arquivos

### `User` — grupo M

- Finalidade: conta autenticável e identidade técnica.
- Campos O: `name`, `email`, `passwordHash`, `status`.
- Campos P: `phone`, `emailVerifiedAt`, `lastLoginAt`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `email`; IX `(status, deletedAt)`. E-mail é normalizado antes da persistência; reutilização após exclusão depende de índice parcial futuro.
- Exclusão/auditoria: soft delete; senha nunca entra em log/auditoria. Mudança de estado, senha, e-mail ou RBAC gera `AuditLog`.

### `UserSession` — grupo T

- Finalidade: refresh token rotacionável e revogável.
- Campos O: `userId`, `refreshTokenHash`, `expiresAt`.
- Campos P: `rotatedFromSessionId`, `revokedAt`, `revocationReason`, `userAgentHash`, `ipAddressHash`.
- FKs: `userId -> User` (C); `rotatedFromSessionId -> UserSession` (N).
- Índices/restrições: UK `refreshTokenHash`; IX `(userId, revokedAt, expiresAt)`. Apenas hash do token é persistido.
- Exclusão/auditoria: revogação é preservada; limpeza física só após retenção aprovada. Reutilização suspeita e revogação em massa geram auditoria de segurança.

### `UserToken` — grupo T

- Finalidade: token de uso único para recuperação de senha/verificação de e-mail.
- Campos O: `userId`, `type`, `tokenHash`, `expiresAt`.
- Campos P: `consumedAt`.
- FKs: `userId -> User` (C).
- Índices/restrições: UK `tokenHash`; IX `(userId, type, expiresAt)`. Token consumido/expirado não pode voltar a ser válido.
- Exclusão/auditoria: limpeza por retenção; valor em claro nunca é persistido nem logado.

### `Role` — grupo M

- Finalidade: agrupador administrável de permissões.
- Campos O: `code`, `name`, `isSystem`.
- Campos P: `description`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `code`; IX `(deletedAt, name)`. Papel de sistema não pode ser removido pela aplicação.
- Exclusão/auditoria: soft delete; criação, edição e inativação geram `AuditLog`.

### `Permission` — grupo M

- Finalidade: capacidade atômica validada pela API.
- Campos O: `code`, `name`, `isSystem`.
- Campos P: `description`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `code`; IX `(deletedAt, name)`.
- Exclusão/auditoria: soft delete; mudanças geram `AuditLog`.

### `UserRole` — grupo A

- Finalidade: associação com identidade entre usuário e papel.
- Campos O: `userId`, `roleId`.
- Campos P: `grantedById`, `expiresAt`.
- FKs: `userId -> User` (R); `roleId -> Role` (R); `grantedById -> User` (N).
- Índices/restrições: UK `(userId, roleId)`; IX `(roleId, expiresAt)`.
- Exclusão/auditoria: revogação funcional deve ser auditada antes da remoção da associação; concessor e instante ficam preservados.

### `RolePermission` — grupo A

- Finalidade: associação com identidade entre papel e permissão.
- Campos O: `roleId`, `permissionId`.
- Campos P: `grantedById`.
- FKs: `roleId -> Role` (R); `permissionId -> Permission` (R); `grantedById -> User` (N).
- Índices/restrições: UK `(roleId, permissionId)`; IX `permissionId`.
- Exclusão/auditoria: inclusão/remoção gera `AuditLog`; não se remove papel/permissão referenciado sem governança.

### `TeamSettings` — cadastro mutável sem exclusão

- Finalidade: configuração institucional singleton.
- Campos O: `singletonKey`, `teamName`, `officialName`, `defaultCurrency`, `timeZone`, `createdAt`, `updatedAt`.
- Campos P: `description`, `history`, `email`, `phone`, `socialLinks`, `addressLine1`, `addressLine2`, `addressCity`, `addressState`, `addressPostalCode`, `addressCountry`, `primaryColor`, `secondaryColor`, `pixKeyEncrypted`, `bankingDetailsEncrypted`, `encryptionKeyVersion`, `termsOfUse`, `privacyPolicy`, `monthlyFeeRules`, `storeRules`, `pickupInstructions`, `notificationSettings`, `updatedById`.
- FKs: `updatedById -> User` (N).
- Índices/restrições: UK `singletonKey`; moeda com três letras; cores em formato validado; só a chave lógica `main` será aceita enquanto houver uma configuração.
- Exclusão/auditoria: não excluído; toda alteração registra autor e valores minimizados no `AuditLog`. Campos bancários são cifrados e nunca retornados na projeção pública.

### `TeamBrandAsset` — cadastro mutável sem exclusão

- Finalidade: mídia vigente por contexto de marca.
- Campos O: `teamSettingsId`, `mediaFileId`, `context`, `createdAt`, `updatedAt`.
- Campos P: `altText`.
- FKs: `teamSettingsId -> TeamSettings` (C); `mediaFileId -> MediaFile` (R).
- Índices/restrições: UK `(teamSettingsId, context)`; IX `mediaFileId`.
- Exclusão/auditoria: substituição atualiza o vínculo e gera `AuditLog`; o arquivo anterior segue sua retenção própria.

### `MediaFile` — grupo M

- Finalidade: metadados e integridade de objeto armazenado fora do banco.
- Campos O: `storageProvider`, `bucket`, `objectKey`, `originalName`, `mimeType`, `sizeBytes`, `checksumSha256`, `kind`, `classification`, `isVerified`.
- Campos P: `extension`, `uploadedById`, `verifiedAt`, `deletedAt`.
- FKs: `uploadedById -> User` (N).
- Índices/restrições: UK `(storageProvider, bucket, objectKey)`; IX `(classification, kind, deletedAt)` e `checksumSha256`. `sizeBytes > 0`; hash SHA-256 hexadecimal; MIME real e extensão são verificados.
- Exclusão/auditoria: soft delete e remoção posterior do objeto somente conforme retenção e ausência de referência; comprovantes/documentos têm acesso e auditoria restritos.

### `AuditLog` — grupo A

- Finalidade: trilha imutável de ação sensível.
- Campos O: `action`, `entityType`, `occurredAt`.
- Campos P: `actorUserId`, `entityId`, `reason`, `beforeData`, `afterData`, `metadata`, `requestId`, `ipAddressHash`, `userAgent`.
- FKs: `actorUserId -> User` (N).
- Índices/restrições: IX `(entityType, entityId, occurredAt)`, `(actorUserId, occurredAt)` e `requestId`.
- Exclusão/auditoria: a própria tabela é append-only; payloads são minimizados/mascarados e nunca contêm credencial, token ou arquivo.

## 4. Atletas, equipes, interessados e inscrições

### `Athlete` — grupo M

- Finalidade: cadastro esportivo de atleta, independente de conta de acesso.
- Campos O: `fullName`, `status`.
- Campos P: `userId`, `preferredName`, `birthDate`, `documentNumberEncrypted`, `documentNumberHash`, `email`, `phone`, `gender`, `position`, `emergencyContactName`, `emergencyContactPhone`, `guardianName`, `guardianPhone`, `notes`, `deletedAt`.
- FKs: `userId -> User` (N).
- Índices/restrições: UK `userId`; UK `documentNumberHash` quando preenchido; IX `(status, deletedAt)` e `(fullName, deletedAt)`. Documento usa cifra + hash cego; campos obrigatórios finais e regra para menor estão pendentes.
- Exclusão/auditoria: soft delete; alteração de status, documento, contato ou responsável gera `AuditLog`. Dados de saúde são proibidos em `notes`.

### `AthleteDocument` — grupo M

- Finalidade: vínculo de documento/arquivo autorizado ao atleta.
- Campos O: `athleteId`, `mediaFileId`, `documentType`.
- Campos P: `documentNumberEncrypted`, `documentNumberHash`, `issuedOn`, `expiresOn`, `deletedAt`.
- FKs: `athleteId -> Athlete` (R); `mediaFileId -> MediaFile` (R).
- Índices/restrições: UK `(athleteId, mediaFileId)`; IX `(athleteId, documentType, deletedAt)` e `expiresOn`. Vencimento não antecede emissão.
- Exclusão/auditoria: soft delete; acesso e download são auditados conforme classificação. Não armazena binário.

### `Category` — grupo M

- Finalidade: categoria esportiva reutilizável por equipes.
- Campos O: `name`, `slug`, `isActive`.
- Campos P: `description`, `minimumAge`, `maximumAge`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `slug`; IX `(isActive, deletedAt)`. Idades são não negativas e `minimumAge <= maximumAge`.
- Exclusão/auditoria: soft delete; não altera a categoria histórica de equipe.

### `Team` — grupo M

- Finalidade: equipe operacional masculina, feminina, mista ou outra.
- Campos O: `name`, `slug`, `type`, `isActive`.
- Campos P: `categoryId`, `description`, `deletedAt`.
- FKs: `categoryId -> Category` (N).
- Índices/restrições: UK `slug`; IX `(categoryId, isActive, deletedAt)`.
- Exclusão/auditoria: soft delete; vínculos históricos permanecem.

### `TeamAthlete` — grupo H

- Finalidade: vínculo temporal N:N entre atleta e equipe.
- Campos O: `athleteId`, `teamId`, `startsOn`, `status`.
- Campos P: `endsOn`, `position`.
- FKs: `athleteId -> Athlete` (R); `teamId -> Team` (R).
- Índices/restrições: UK `(athleteId, teamId, startsOn)`; IX `(teamId, status, startsOn)` e `(athleteId, status)`. `endsOn >= startsOn`; sobreposição depende de regra aprovada.
- Exclusão/auditoria: encerra-se com `endsOn/status`, não se apaga; mudanças de vínculo e período são auditadas.

### `InterestedPerson` — grupo M

- Finalidade: manifestação pública inicial de interesse no time.
- Campos O: `fullName`, `status`.
- Campos P: `userId`, `convertedAthleteId`, `birthDate`, `email`, `phone`, `desiredPosition`, `source`, `notes`, `privacyNoticeVersion`, `consentAt`, `deletedAt`.
- FKs: `userId -> User` (N); `convertedAthleteId -> Athlete` (N).
- Índices/restrições: UK `userId` e `convertedAthleteId` quando preenchidos; IX `(status, createdAt)` e `(email, deletedAt)`. Pelo menos um contato é exigido na borda; base legal/consentimento não é presumida.
- Exclusão/auditoria: soft delete/anônimo conforme retenção; acesso e conversão em atleta geram auditoria.

### `Registration` — removida

- Tabela `registrations` reservada desde a fase 2 sem endpoint e removida pela migração `20261026042015_remove_registrations` (`DT-046`). A inscrição geral sem seletiva é atendida por `InterestedPerson` (`DT-028`).

### `Tryout` — grupo M

- Finalidade: seletiva publicável com janela de inscrição.
- Campos O: `title`, `slug`, `status`.
- Campos P: `teamId`, `eventId`, `description`, `location`, `startsAt`, `registrationStartsAt`, `registrationEndsAt`, `maxSlots`, `cancellationReason`, `deletedAt`.
- FKs: `teamId -> Team` (N); `eventId -> Event` (N).
- Índices/restrições: UK `slug`; UK `eventId` quando preenchido; IX `(status, registrationStartsAt, registrationEndsAt)` e `(teamId, startsAt)`. Fim da inscrição posterior ao início; `maxSlots > 0`. Sem `eventId`, `startsAt/location` são o fallback interno; com `eventId`, ambos ficam nulos e `Event` é a fonte de agenda/local. O evento deve ter tipo `TRYOUT` e não pode possuir `Match`.
- Exclusão/auditoria: soft delete apenas em rascunho sem dependências; seletiva publicada é cancelada/arquivada e auditada.

### `TryoutRegistration` — grupo M

- Finalidade: inscrição de pessoa em uma seletiva específica.
- Campos O: `tryoutId`, `fullName`, `status`.
- Campos P: `applicantUserId`, `athleteId`, `interestedPersonId`, `birthDate`, `email`, `phone`, `gender`, `desiredPosition`, `experience`, `reviewedById`, `reviewedAt`, `reviewReason`, `deletedAt`.
- FKs: `tryoutId -> Tryout` (R); `applicantUserId -> User` (N); `athleteId -> Athlete` (N); `interestedPersonId -> InterestedPerson` (N); `reviewedById -> User` (N).
- Índices/restrições: IX `(tryoutId, status, createdAt)`, `(athleteId, createdAt)` e `(applicantUserId, createdAt)`. Contato obrigatório na borda; unicidade do candidato depende da política pendente.
- Exclusão/auditoria: soft delete; presença, decisão e cancelamento mantêm histórico de autor/motivo em `AuditLog`.

## 5. Mensalidades e pagamentos

### `MonthlyFeePlan` — grupo M

- Finalidade: regra versionável de valor e vencimento de mensalidade.
- Campos O: `name`, `amount`, `currency`, `dueDay`, `status`.
- Campos P: `description`, `validFrom`, `validUntil`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: IX `(status, deletedAt)` e `(validFrom, validUntil)`; `amount >= 0`; `dueDay` entre 1 e 28; período válido.
- Exclusão/auditoria: soft delete/inativação; alteração não recalcula mensalidades emitidas e gera `AuditLog`.

### `AthleteMonthlyFeePlan` — grupo H

- Finalidade: histórico do plano aplicado ao atleta.
- Campos O: `athleteId`, `monthlyFeePlanId`, `startsOn`, `status`.
- Campos P: `endsOn`, `amountOverride`, `currency`.
- FKs: `athleteId -> Athlete` (R); `monthlyFeePlanId -> MonthlyFeePlan` (R).
- Índices/restrições: UK `(athleteId, monthlyFeePlanId, startsOn)`; IX `(athleteId, status, startsOn)`; fim não anterior ao início; override exige moeda e não pode ser negativo.
- Exclusão/auditoria: encerrado/cancelado, não apagado; sobreposição de planos ativos depende da regra aprovada.

### `MonthlyFee` — grupo H

- Finalidade: cobrança mensal congelada para um atleta.
- Campos O: `athleteId`, `monthlyFeePlanId`, `referenceMonth`, `dueDate`, `originalAmount`, `discountAmount`, `additionalAmount`, `totalAmount`, `currency`, `status`.
- Campos P: `athleteMonthlyFeePlanId`, `notes`, `createdById`, `cancelledById`, `cancelledAt`, `cancellationReason`.
- FKs: `athleteId -> Athlete` (R); `monthlyFeePlanId -> MonthlyFeePlan` (R); `athleteMonthlyFeePlanId -> AthleteMonthlyFeePlan` (N); `createdById -> User` (N); `cancelledById -> User` (N).
- Índices/restrições: UK `(athleteId, referenceMonth)`; IX `(status, dueDate)`, `(athleteId, status)` e `(referenceMonth, status)`. Referência é o primeiro dia do mês; valores não negativos; total coerente.
- Exclusão/auditoria: não excluída; cancelamento exige autor/motivo. Alteração financeira preserva antes/depois permitido no `AuditLog`.

### `MonthlyFeePayment` — grupo A

- Finalidade: alocação de um pagamento a uma mensalidade.
- Campos O: `monthlyFeeId`, `paymentId`, `allocatedAmount`, `currency`.
- Campos P: `createdById`.
- FKs: `monthlyFeeId -> MonthlyFee` (R); `paymentId -> Payment` (R); `createdById -> User` (N).
- Índices/restrições: UK `(monthlyFeeId, paymentId)`; IX `paymentId`; alocação positiva, mesma moeda e soma não superior ao pagamento/cobrança sem regra explícita de crédito.
- Exclusão/auditoria: append-only após confirmação; correção cria alocação compensatória/processo auditado, não reescreve histórico.

### `PaymentMethod` — grupo M

- Finalidade: catálogo administrável de formas de pagamento usadas em pagamentos, previsões de contas e movimentações efetivas.
- Campos O: `code`, `name`, `type`, `isActive`.
- Campos P: `description`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `code`; IX `(isActive, deletedAt)`.
- Exclusão/auditoria: soft delete/inativação; pagamentos, obrigações e movimentações históricas preservam a referência ou o snapshot auditado.

### `Payment` — grupo H

- Finalidade: fato de pagamento manual ou de provedor.
- Campos O: `paymentMethodId`, `amount`, `currency`, `status`, `idempotencyKey`.
- Campos P: `orderId`, `payerUserId`, `provider`, `externalReference`, `paidAt`, `failureReason`, `notes`, `createdById`.
- FKs: `paymentMethodId -> PaymentMethod` (R); `orderId -> Order` (R); `payerUserId -> User` (N); `createdById -> User` (N).
- Índices/restrições: UK `idempotencyKey`; UK `(provider, externalReference)` quando aplicável; IX `(status, createdAt)`, `(orderId, status)` e `(payerUserId, createdAt)`. Valor positivo; confirmação exige `paidAt`.
- Exclusão/auditoria: não excluído; cancelamento/estorno muda estado por transição autorizada e mantém auditoria. Não armazena dados de cartão.

### `Refund` — grupo H

- Finalidade: reembolso parcial ou total explicitamente vinculado ao pagamento.
- Campos O: `paymentId`, `amount`, `currency`, `status`, `reason`, `idempotencyKey`.
- Campos P: `orderId`, `requestedById`, `approvedById`, `approvedAt`, `processedAt`, `providerReference`, `rejectionReason`.
- FKs: `paymentId -> Payment` (R); `orderId -> Order` (R); `requestedById -> User` (N); `approvedById -> User` (N).
- Índices/restrições: UK `idempotencyKey`; IX `(paymentId, status)` e `(status, createdAt)`. Valor positivo, mesma moeda e total concluído não superior ao pago ainda não reembolsado. Quando `orderId` estiver preenchido, ele corresponde ao pedido do pagamento.
- Exclusão/auditoria: não excluído; aprovação, rejeição e conclusão guardam autor/motivo e originam saída financeira quando concluídas.

## 6. Caixa Fênix

### `FinancialAccount` — grupo M

- Finalidade: conta física/lógica cujas movimentações formam o saldo.
- Campos O: `code`, `name`, `type`, `currency`, `isActive`.
- Campos P: `institutionName`, `branch`, `accountLastFour`, `description`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `code`; IX `(isActive, type, deletedAt)`. Não existe saldo inicial editável; abertura é `FinancialTransaction`.
- Exclusão/auditoria: soft delete/inativação; conta com fatos não é apagada. Mudança cadastral gera auditoria.

### `FinancialCategory` — grupo M

- Finalidade: plano hierárquico de categorias de receita, despesa ou transferência.
- Campos O: `code`, `name`, `nature`, `isActive`.
- Campos P: `parentId`, `description`, `deletedAt`.
- FKs: `parentId -> FinancialCategory` (R).
- Índices/restrições: UK `code`; IX `(nature, isActive, deletedAt)` e `parentId`; sem ciclo; pai e filho com natureza compatível.
- Exclusão/auditoria: soft delete/inativação; não altera lançamentos históricos.

### `CostCenter` — grupo M

- Finalidade: dimensão hierárquica de apropriação financeira.
- Campos O: `code`, `name`, `isActive`.
- Campos P: `parentId`, `description`, `deletedAt`.
- FKs: `parentId -> CostCenter` (R).
- Índices/restrições: UK `code`; IX `(isActive, deletedAt)` e `parentId`; hierarquia sem ciclo.
- Exclusão/auditoria: soft delete/inativação; uso histórico preservado.

### `FinancialObligation` — grupo H

- Finalidade: conta a pagar/receber prevista, sem afetar saldo antes da liquidação.
- Campos O: `type`, `status`, `categoryId`, `counterpartyName`, `description`, `competenceDate`, `dueDate`, `amount`, `currency`, `idempotencyKey`.
- Campos P: `costCenterId`, `partnerId`, `plannedPaymentMethodId`, `settlementTransactionId`, `settledAt`, `notes`, `createdById`, `cancelledById`, `cancelledAt`, `cancellationReason`.
- FKs: `categoryId -> FinancialCategory` (R); `costCenterId -> CostCenter` (N); `partnerId -> Partner` (R); `plannedPaymentMethodId -> PaymentMethod` (R); `settlementTransactionId -> FinancialTransaction` (R); `createdById -> User` (N); `cancelledById -> User` (N).
- Índices/restrições: UK `idempotencyKey`; UK `settlementTransactionId` quando preenchido; IX `(type, status, dueDate)`, `(partnerId, status)`, `(plannedPaymentMethodId, dueDate)` e `(categoryId, competenceDate)`. Valor positivo; `SETTLED` exige transação/data coerentes; categoria compatível com payable/receivable. O método previsto pode mudar antes da liquidação, mas o método efetivo fica na transação.
- Exclusão/auditoria: não excluída após registro; cancelamento exige autor/motivo. Liquidação é transacional e auditada.

### `FinancialTransaction` — grupo H

- Finalidade: fato que aumenta ou reduz o saldo de uma conta.
- Campos O: `accountId`, `categoryId`, `direction`, `origin`, `status`, `amount`, `currency`, `competenceDate`, `description`, `idempotencyKey`.
- Campos P: `costCenterId`, `paymentMethodId`, `paymentId`, `refundId`, `partnerSettlementId`, `reversesTransactionId`, `cashClosingId`, `dueDate`, `occurredAt`, `confirmedAt`, `notes`, `createdById`, `confirmedById`, `cancelledById`, `cancelledAt`, `cancellationReason`, `reconciledAt`, `reconciledById`, `statementReference`.
- FKs: `accountId -> FinancialAccount` (R); `categoryId -> FinancialCategory` (R); `costCenterId -> CostCenter` (N); `paymentMethodId -> PaymentMethod` (R); `paymentId -> Payment` (R); `refundId -> Refund` (R); `partnerSettlementId -> PartnerSettlement` (R); `reversesTransactionId -> FinancialTransaction` (R); `cashClosingId -> CashClosing` (R); `createdById -> User` (N); `confirmedById -> User` (N); `cancelledById -> User` (N); `reconciledById -> User` (N).
- Índices/restrições: UK `idempotencyKey`; UK nas FKs automáticas quando preenchidas; IX `(accountId, status, occurredAt)`, `(categoryId, competenceDate)`, `(costCenterId, competenceDate)`, `(paymentMethodId, occurredAt)`, `(origin, status)` e `reversesTransactionId`. Valor positivo; origem/FK/direção coerentes; confirmação exige `occurredAt/confirmedAt`. Se derivada de `Payment`, moeda e método efetivo correspondem ao pagamento. Se ligada a `CashClosing`, conta, moeda e instante pertencem ao fechamento.
- Exclusão/auditoria: confirmado nunca é apagado/reduzido; cancelamento ou reversão vinculada exige autor, instante e motivo.

### `FinancialTransfer` — grupo A

- Finalidade: unidade que vincula as pernas de saída e entrada entre contas.
- Campos O: `sourceAccountId`, `destinationAccountId`, `debitTransactionId`, `creditTransactionId`, `amount`, `currency`, `transferredAt`, `idempotencyKey`.
- Campos P: `createdById`, `description`.
- FKs: `sourceAccountId -> FinancialAccount` (R); `destinationAccountId -> FinancialAccount` (R); `debitTransactionId -> FinancialTransaction` (R); `creditTransactionId -> FinancialTransaction` (R); `createdById -> User` (N).
- Índices/restrições: UK `debitTransactionId`, UK `creditTransactionId`, UK `idempotencyKey`; IX `(sourceAccountId, transferredAt)` e `(destinationAccountId, transferredAt)`. Contas/pernas distintas, mesmo valor/moeda, sentidos opostos.
- Exclusão/auditoria: append-only; correção usa reversões das duas pernas, vinculadas e auditadas.

### `FinancialTransactionAttachment` — grupo M

- Finalidade: comprovante/documento de pagamento e/ou movimentação por `MediaFile`.
- Campos O: `mediaFileId`, `type`.
- Campos P: `financialTransactionId`, `paymentId`, `description`, `deletedAt`.
- FKs: `financialTransactionId -> FinancialTransaction` (R); `paymentId -> Payment` (R); `mediaFileId -> MediaFile` (R).
- Índices/restrições: UK `(financialTransactionId, mediaFileId)` e `(paymentId, mediaFileId)`; IX por alvo/tipo/exclusão. Ao menos um alvo deve existir.
- Exclusão/auditoria: soft delete apenas conforme retenção; inclusão, acesso e retirada são auditados. Binário permanece fora do banco.

### `CashClosing` — grupo H

- Finalidade: conferência e fechamento de conta por período.
- Campos O: `financialAccountId`, `periodStart`, `periodEnd`, `expectedBalance`, `countedBalance`, `differenceAmount`, `currency`, `status`, `idempotencyKey`.
- Campos P: `notes`, `closedById`, `closedAt`, `reopenedById`, `reopenedAt`, `reopeningReason`.
- FKs: `financialAccountId -> FinancialAccount` (R); `closedById -> User` (N); `reopenedById -> User` (N).
- Índices/restrições: UK `(financialAccountId, periodStart, periodEnd)` e `idempotencyKey`; IX `(financialAccountId, status, periodEnd)`. Período válido; moeda da conta; diferença = contado − esperado. Toda movimentação abrangida usa a mesma conta/moeda e `occurredAt` dentro do período.
- Exclusão/auditoria: não excluído; fechar/reabrir exige permissão, autor, instante e, na reabertura, motivo.

## 7. Loja, estoque, carrinho, pedidos e campanhas

### `ProductCategory` — grupo M

- Finalidade: taxonomia hierárquica do catálogo.
- Campos O: `name`, `slug`, `isActive`.
- Campos P: `parentId`, `description`, `deletedAt`.
- FKs: `parentId -> ProductCategory` (R).
- Índices/restrições: UK `slug`; IX `(isActive, deletedAt)` e `parentId`; hierarquia sem ciclo.
- Exclusão/auditoria: soft delete/inativação; produtos existentes mantêm categoria.

### `Product` — grupo M

- Finalidade: item comercial próprio ou de parceiro.
- Campos O: `productCategoryId`, `name`, `slug`, `fulfillmentType`, `basePrice`, `currency`, `status`, `isFeatured`.
- Campos P: `partnerId`, `brand`, `description`, `promotionalPrice`, `costPrice`, `buyerLimit`, `availableFrom`, `availableUntil`, `productionLeadDays`, `pickupInstructions`, `commissionTypeOverride`, `commissionPercentageOverride`, `commissionFixedOverride`, `deletedAt`.
- FKs: `productCategoryId -> ProductCategory` (R); `partnerId -> Partner` (R).
- Índices/restrições: UK `slug`; IX `(productCategoryId, status, deletedAt)`, `(partnerId, status)` e `(fulfillmentType, status, availableFrom, availableUntil)`. Valores não negativos; período válido; `DIGITAL` reservado e proibido em produto ativo nesta fase.
- Exclusão/auditoria: soft delete; produto referenciado não é apagado. Preço, custo, parceiro, comissão e estado geram auditoria.

### `ProductImage` — grupo M

- Finalidade: imagem ordenada do produto.
- Campos O: `productId`, `mediaFileId`, `sortOrder`, `isPrimary`.
- Campos P: `altText`, `deletedAt`.
- FKs: `productId -> Product` (R); `mediaFileId -> MediaFile` (R).
- Índices/restrições: UK `(productId, mediaFileId)`; IX `(productId, sortOrder, deletedAt)`. Apenas uma imagem principal ativa por produto via índice parcial futuro.
- Exclusão/auditoria: soft delete; alteração de principal/mídia é auditada.

### `ProductVariant` — grupo M

- Finalidade: unidade vendável e estocável, inclusive variante padrão.
- Campos O: `productId`, `sku`, `name`, `minimumStock`, `isActive`.
- Campos P: `size`, `color`, `gender`, `attributes`, `priceOverride`, `promotionalPriceOverride`, `costPriceOverride`, `deletedAt`.
- FKs: `productId -> Product` (R).
- Índices/restrições: UK `sku`; IX `(productId, isActive, deletedAt)` e `(minimumStock, isActive)`. Valores não negativos; `minimumStock >= 0`; JSON de atributos validado.
- Exclusão/auditoria: soft delete/inativação; SKU e snapshots de pedido permanecem rastreáveis.

### `InventoryMovement` — grupo A

- Finalidade: fato imutável que compõe estoque da variante.
- Campos O: `productVariantId`, `type`, `quantityDelta`, `occurredAt`.
- Campos P: `orderItemId`, `reason`, `createdById`.
- FKs: `productVariantId -> ProductVariant` (R); `orderItemId -> OrderItem` (N); `createdById -> User` (N).
- Índices/restrições: IX `(productVariantId, occurredAt)`, `(orderItemId, type)` e `(type, occurredAt)`. Delta diferente de zero; sinal compatível com tipo; ajuste exige motivo. Quando `orderItemId` existir, o item e o movimento usam a mesma variante.
- Exclusão/auditoria: append-only; correção cria movimento compensatório. Saldo/estoque disponível é derivado.

### `SalesCampaign` — grupo M

- Finalidade: remessa/campanha com janela de venda e etapas de produção/retirada.
- Campos O: `name`, `slug`, `salesStartAt`, `salesEndAt`, `currency`, `status`.
- Campos P: `supplierPartnerId`, `description`, `minimumQuantity`, `maximumQuantity`, `supplierOrderedOn`, `expectedProductionOn`, `expectedArrivalOn`, `receivedOn`, `pickupStartsOn`, `pickupEndsOn`, `refundPolicy`, `cancellationReason`, `createdById`, `deletedAt`.
- FKs: `supplierPartnerId -> Partner` (R); `createdById -> User` (N).
- Índices/restrições: UK `slug`; IX `(status, salesStartAt, salesEndAt)` e `(supplierPartnerId, status)`. Janela válida; quantidades positivas e mínimo <= máximo.
- Exclusão/auditoria: soft delete só em rascunho sem venda; demais casos usam cancelamento/transição auditada.

### `SalesCampaignProduct` — grupo M

- Finalidade: associação com identidade entre campanha e produto.
- Campos O: `salesCampaignId`, `productId`, `isActive`.
- Campos P: `campaignPrice`, `minimumQuantity`, `maximumQuantity`, `deletedAt`.
- FKs: `salesCampaignId -> SalesCampaign` (R); `productId -> Product` (R).
- Índices/restrições: UK `(salesCampaignId, productId)`; IX `(productId, isActive, deletedAt)`. Preço não negativo; limites positivos/coerentes e moeda herdada/validada contra campanha.
- Exclusão/auditoria: soft delete antes da venda; após item de pedido, associação permanece histórica.

### `Favorite` — grupo A

- Finalidade: produto favorito privado de usuário.
- Campos O: `userId`, `productId`.
- Campos P: nenhum.
- FKs: `userId -> User` (C); `productId -> Product` (R).
- Índices/restrições: UK `(userId, productId)`; IX `productId`.
- Exclusão/auditoria: desfavoritar remove a associação; não é fato financeiro/sensível.

### `Cart` — grupo T

- Finalidade: carrinho autenticado ou anônimo convertido no máximo uma vez.
- Campos O: `status`, `expiresAt`.
- Campos P: `userId`, `guestKeyHash`, `convertedOrderId`.
- FKs: `userId -> User` (C); `convertedOrderId -> Order` (N).
- Índices/restrições: UK `convertedOrderId`; IX `(userId, status, expiresAt)` e `(guestKeyHash, status)`. Exatamente um proprietário (`userId` XOR `guestKeyHash`); chave anônima somente como hash.
- Exclusão/auditoria: limpeza física após expiração/retenção; conversão registra vínculo ao pedido.

### `CartItem` — grupo T

- Finalidade: variante e quantidade dentro do carrinho.
- Campos O: `cartId`, `productVariantId`, `quantity`.
- Campos P: `salesCampaignProductId`.
- FKs: `cartId -> Cart` (C); `productVariantId -> ProductVariant` (R); `salesCampaignProductId -> SalesCampaignProduct` (N).
- Índices/restrições: IX `(cartId, productVariantId)` e `salesCampaignProductId`; `quantity > 0`. Índices únicos parciais futuros impedem linha duplicada com/sem campanha. Quando houver campanha, seu produto corresponde ao produto da variante.
- Exclusão/auditoria: removido com o carrinho; preço/estoque são revalidados no servidor na conversão.

### `Order` — grupo H

- Finalidade: pedido de usuário ou visitante identificado.
- Campos O: `orderNumber`, `customerName`, `subtotalAmount`, `discountAmount`, `totalAmount`, `currency`, `status`.
- Campos P: `customerUserId`, `customerEmail`, `customerPhone`, `notes`, `paidAt`, `readyForPickupAt`, `deliveredAt`, `cancelledAt`, `cancellationReason`.
- FKs: `customerUserId -> User` (N).
- Índices/restrições: UK `orderNumber`; IX `(status, createdAt)`, `(customerUserId, createdAt)` e `(customerEmail, createdAt)`. Pelo menos e-mail ou telefone; valores não negativos e total coerente.
- Exclusão/auditoria: não excluído após confirmação; cancelamento/reembolso preserva histórico e snapshots.

### `OrderItem` — grupo H

- Finalidade: snapshot imutável do item comprado.
- Campos O: `orderId`, `productId`, `productVariantId`, `productName`, `sku`, `quantity`, `unitPrice`, `discountAmount`, `totalAmount`, `currency`.
- Campos P: `salesCampaignProductId`, `partnerId`, `selectedAttributes`, `commissionTypeSnapshot`, `commissionRateSnapshot`, `commissionFixedSnapshot`, `partnerAmountSnapshot`, `arrivalNotifiedAt`, `pickedUpAt`.
- FKs: `orderId -> Order` (R); `productId -> Product` (R); `productVariantId -> ProductVariant` (R); `salesCampaignProductId -> SalesCampaignProduct` (R); `partnerId -> Partner` (R).
- Índices/restrições: IX `orderId`, `(productVariantId, createdAt)`, `(salesCampaignProductId, createdAt)`, `(partnerId, createdAt)`. Quantidade positiva; valores e comissão não negativos; total coerente. A variante e o produto de campanha pertencem a `productId`.
- Exclusão/auditoria: não excluído separadamente; snapshot não acompanha edições posteriores do catálogo.

## 8. Parceiros, serviços, disponibilidade e repasses

### `Partner` — grupo M

- Finalidade: parceiro aprovado, fornecedor, loja, profissional ou patrocinador.
- Campos O: `legalName`, `displayName`, `type`, `status`, `commissionType`.
- Campos P: `documentNumberEncrypted`, `documentNumberHash`, `contactName`, `email`, `phone`, `description`, `websiteUrl`, `contractStartsOn`, `contractEndsOn`, `logoMediaFileId`, `commissionPercentage`, `commissionFixedAmount`, `commissionCurrency`, `contractNotes`, `deletedAt`.
- FKs: `logoMediaFileId -> MediaFile` (N).
- Índices/restrições: UK `documentNumberHash` quando preenchido; IX `(status, type, deletedAt)` e `displayName`. Contrato válido; percentual/faixa e valor fixo não negativos; campos de comissão coerentes com o tipo.
- Exclusão/auditoria: soft delete/inativação; aprovação, contrato e comissão geram `AuditLog`. Documento é cifrado + hash cego.

### `PartnerDocument` — grupo M

- Finalidade: vínculo de contrato/documento do parceiro a arquivo externo controlado.
- Campos O: `partnerId`, `mediaFileId`, `documentType`.
- Campos P: `issuedOn`, `expiresOn`, `deletedAt`.
- FKs: `partnerId -> Partner` (R); `mediaFileId -> MediaFile` (R).
- Índices/restrições: UK `(partnerId, mediaFileId)`; IX `(partnerId, documentType, deletedAt)` e `expiresOn`; vencimento não antecede emissão.
- Exclusão/auditoria: soft delete e retenção contratual; inclusão, acesso e retirada são auditados. Não armazena binário.

### `PartnerProfessional` — grupo M

- Finalidade: profissional vinculado a parceiro aprovado.
- Campos O: `partnerId`, `fullName`, `profession`, `status`.
- Campos P: `userId`, `licenseNumberEncrypted`, `licenseNumberHash`, `email`, `phone`, `publicBio`, `publicContact` (padrão `false`: contato só fica público com autorização), `deletedAt`.
- FKs: `partnerId -> Partner` (R); `userId -> User` (N).
- Índices/restrições: UK `userId`; UK `(partnerId, licenseNumberHash)` quando preenchido; IX `(partnerId, status, deletedAt)` e `profession`.
- Exclusão/auditoria: soft delete/inativação; eventual acesso próprio depende de permissão aprovada. Não armazena informação clínica.

### `PartnerService` — grupo M

- Finalidade: serviço oferecido pelo parceiro e, opcionalmente, por profissional específico.
- Campos O: `partnerId`, `name`, `durationMinutes`, `status`.
- Campos P: `professionalId`, `description`, `price`, `currency`, `deletedAt`.
- FKs: `partnerId -> Partner` (R); `professionalId -> PartnerProfessional` (N).
- Índices/restrições: IX `(partnerId, status, deletedAt)` e `(professionalId, status)`. Duração positiva; preço não negativo e exige moeda; profissional precisa pertencer ao mesmo parceiro.
- Exclusão/auditoria: soft delete/inativação; agendamentos mantêm a referência e preço cotado.

### `ProfessionalAvailability` — grupo H

- Finalidade: intervalo disponível, bloqueado ou reservado.
- Campos O: `professionalId`, `startsAt`, `endsAt`, `status`.
- Campos P: `partnerServiceId`, `notes`.
- FKs: `professionalId -> PartnerProfessional` (R); `partnerServiceId -> PartnerService` (N).
- Índices/restrições: IX `(professionalId, startsAt, endsAt, status)` e `(partnerServiceId, startsAt)`; fim posterior ao início. Intervalos ativos (livre/reservado) do mesmo profissional não se sobrepõem (`DT-033`); recorrência depende de política futura.
- Exclusão/auditoria: não apagado depois de usado; bloqueio e reserva preservam histórico de transição.

### `Appointment` — grupo H

- Finalidade: solicitação e eventual confirmação de serviço parceiro.
- Campos O: `partnerServiceId`, `requesterUserId`, `status`.
- Campos P: `professionalId`, `availabilityId`, `athleteId`, `requestedStartsAt`, `requestedEndsAt`, `scheduledStartsAt`, `scheduledEndsAt`, `quotedPrice`, `currency`, `requesterNotes` (até 500, sem dados de saúde), `administrativeNotes`, `confirmedAt`, `cancelledAt`, `cancellationReason`.
- FKs: `partnerServiceId -> PartnerService` (R); `professionalId -> PartnerProfessional` (N); `availabilityId -> ProfessionalAvailability` (N); `requesterUserId -> User` (R); `athleteId -> Athlete` (N).
- Índices/restrições: UK `availabilityId` quando preenchido; IX `(requesterUserId, status, createdAt)`, `(professionalId, scheduledStartsAt)` e `(partnerServiceId, status)`. Intervalos válidos; preço exige moeda; serviço/profissional/parceiro coerentes.
- Exclusão/auditoria: não excluído; confirmação/cancelamento/no-show são auditados. Notas clínicas ou dados de saúde são proibidos.

### `PartnerSettlement` — grupo H

- Finalidade: repasse financeiro apurado para um parceiro em um período.
- Campos O: `partnerId`, `periodStart`, `periodEnd`, `grossSalesAmount`, `commissionAmount`, `adjustmentAmount`, `netPayableAmount`, `currency`, `status`, `idempotencyKey`.
- Campos P: `adjustmentReason` (obrigatório com ajuste), `dueDate`, `paidAt`, `notes`, `createdById`, `approvedById`, `approvedAt`, `cancelledAt`, `cancellationReason`.
- FKs: `partnerId -> Partner` (R); `createdById -> User` (N); `approvedById -> User` (N).
- Índices/restrições: UK `idempotencyKey`; IX `(partnerId, status, periodEnd)` e `(status, dueDate)`. Período válido; bruto, comissão e líquido são não negativos; `adjustmentAmount` é assinado; valores são coerentes; aprovação/pagamento exigem autor/instante correspondente.
- Exclusão/auditoria: não excluído; cancelamento antes do pagamento libera os itens e registra a composição liberada na auditoria (`DT-033`). Pagamento gera uma única saída financeira vinculada; repasse pago não é cancelado.

### `PartnerSettlementItem` — grupo A

- Finalidade: composição imutável do repasse por item de pedido.
- Campos O: `partnerSettlementId`, `orderItemId`, `grossAmount`, `commissionAmount`, `netAmount`, `currency`.
- Campos P: nenhum.
- FKs: `partnerSettlementId -> PartnerSettlement` (R); `orderItemId -> OrderItem` (R).
- Índices/restrições: UK `orderItemId`; IX `partnerSettlementId`. Valores não negativos, mesma moeda e `net = gross - commission` conforme ajustes que pertencem ao cabeçalho. O parceiro do `OrderItem` corresponde ao parceiro do repasse.
- Exclusão/auditoria: imutável; itens de repasse não pago só são removidos no cancelamento do repasse (`DT-033`), e alteração exige cancelar e gerar novo repasse.

## 9. Conteúdo, eventos, fórum e notificações

### `NewsCategory` — grupo M

- Finalidade: categoria editorial exclusiva de notícias.
- Campos O: `name`, `slug`, `isActive`.
- Campos P: `description`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `slug`; IX `(isActive, deletedAt)`.
- Exclusão/auditoria: soft delete/inativação; notícias mantêm a categoria histórica.

### `Event` — grupo M

- Finalidade: ocorrência de calendário reutilizável por notícias, partidas e seletivas.
- Campos O: `title`, `slug`, `type`, `status`, `startsAt`, `isPublic`.
- Campos P: `description`, `endsAt`, `locationName`, `address`, `publishedAt`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `slug`; IX `(status, startsAt)`, `(type, startsAt)` e `(isPublic, publishedAt)`. Fim posterior ao início; publicação pública coerente com estado/data. Com `Tryout`, o tipo é `TRYOUT`; com `Match`, é `MATCH` ou `FRIENDLY`; os dois detalhes são mutuamente exclusivos.
- Exclusão/auditoria: soft delete em rascunho; publicado é cancelado/arquivado por transição auditada.

### `Match` — cadastro mutável sem exclusão independente

- Finalidade: detalhe esportivo 1:1 de um evento de partida/amistoso.
- Campos O: `eventId`, `opponentName`, `isHome`.
- Campos P: `teamId`, `competitionName`, `teamScore`, `opponentScore`, `notes`.
- FKs: `eventId -> Event` (R); `teamId -> Team` (N).
- Índices/restrições: UK `eventId`; IX `(teamId, eventId)` e `opponentName`. Placar não negativo e só publicado quando permitido pelo estado do evento.
- Exclusão/auditoria: acompanha o ciclo do evento; alteração de placar/evento gera auditoria.

### `ForumCategory` — grupo M

- Finalidade: organização e política de visibilidade do fórum.
- Campos O: `name`, `slug`, `visibility`, `isActive`.
- Campos P: `description`, `deletedAt`.
- FKs: nenhuma.
- Índices/restrições: UK `slug`; IX `(visibility, isActive, deletedAt)`.
- Exclusão/auditoria: soft delete/inativação; conteúdo histórico é preservado.

### `ForumTopic` — grupo M

- Finalidade: tópico/comunicado que agrupa publicações.
- Campos O: `categoryId`, `title`, `visibility`, `status`, `isPinned`.
- Campos P: `authorUserId`, `pinnedAt`, `closedAt`, `deletedAt`.
- FKs: `categoryId -> ForumCategory` (R); `authorUserId -> User` (N).
- Índices/restrições: IX `(categoryId, status, isPinned, createdAt)`, `(authorUserId, createdAt)` e `(visibility, status)`. Fixado exige `pinnedAt`; fechado exige `closedAt`.
- Exclusão/auditoria: soft delete/moderação; mudança de visibilidade, fixação, fechamento ou estado gera ação de moderação/auditoria.

### `ForumPost` — grupo M

- Finalidade: publicação inicial ou resposta dentro do tópico.
- Campos O: `topicId`, `content`, `status`.
- Campos P: `authorUserId`, `parentPostId`, `editedAt`, `deletedAt`.
- FKs: `topicId -> ForumTopic` (R); `authorUserId -> User` (N); `parentPostId -> ForumPost` (R).
- Índices/restrições: IX `(topicId, status, createdAt)`, `(authorUserId, createdAt)` e `parentPostId`. Pai deve pertencer ao mesmo tópico; conteúdo não vazio e limitado na borda.
- Exclusão/auditoria: exclusão lógica/estado `DELETED`; conteúdo moderado permanece acessível apenas a autorizados e ações ficam registradas.

### `ForumReaction` — grupo A

- Finalidade: reação idempotente de um usuário a uma publicação.
- Campos O: `postId`, `userId`, `type`.
- Campos P: nenhum.
- FKs: `postId -> ForumPost` (C); `userId -> User` (C).
- Índices/restrições: UK `(postId, userId)`; IX `(postId, type)`.
- Exclusão/auditoria: remoção física ao desfazer reação; abuso pode ser auditado/moderado.

### `ForumReport` — grupo H

- Finalidade: denúncia restrita à moderação contra tópico ou post.
- Campos O: `reporterUserId`, `reason`, `status`.
- Campos P: `topicId`, `postId`, `details`, `reviewedById`, `reviewedAt`, `resolution`.
- FKs: `topicId -> ForumTopic` (R); `postId -> ForumPost` (R); `reporterUserId -> User` (R); `reviewedById -> User` (N).
- Índices/restrições: IX `(status, createdAt)`, `topicId`, `postId` e `(reporterUserId, createdAt)`. Exatamente um alvo; resolução exige revisão.
- Exclusão/auditoria: não excluída pela aplicação; acesso limitado, decisão e responsável preservados.

### `ForumModerationAction` — grupo A

- Finalidade: histórico imutável de ação sobre tópico ou post.
- Campos O: `moderatorUserId`, `action`, `reason`.
- Campos P: `topicId`, `postId`, `beforeData`, `afterData`.
- FKs: `topicId -> ForumTopic` (R); `postId -> ForumPost` (R); `moderatorUserId -> User` (R).
- Índices/restrições: IX `(topicId, createdAt)`, `(postId, createdAt)` e `(moderatorUserId, createdAt)`. Exatamente um alvo; motivo obrigatório.
- Exclusão/auditoria: append-only; conteúdo anterior/novo é minimizado e não replica dados pessoais desnecessários.

### `News` — grupo M

- Finalidade: notícia/comunicado com publicação imediata ou agendada e relações editoriais.
- Campos O: `categoryId`, `title`, `slug`, `content`, `status`, `showOnHome`, `showOnForum`, `isFeatured`.
- Campos P: `authorUserId`, `coverMediaFileId`, `eventId`, `forumTopicId`, `summary`, `scheduledAt`, `publishedAt`, `deletedAt`.
- FKs: `categoryId -> NewsCategory` (R); `authorUserId -> User` (N); `coverMediaFileId -> MediaFile` (N); `eventId -> Event` (N); `forumTopicId -> ForumTopic` (N).
- Índices/restrições: UK `slug`; IX `(status, scheduledAt, publishedAt)`, `(showOnHome, status, publishedAt)`, `(showOnForum, status, publishedAt)`, `eventId` e `forumTopicId`. Estado publicado exige `publishedAt`; agendado exige `scheduledAt`.
- Exclusão/auditoria: soft delete/arquivamento; edição/publicação/ocultação geram auditoria e não duplicam evento ou tópico.

### `Notification` — grupo M

- Finalidade: caixa de entrada e estado de entrega de aviso.
- Campos O: `userId`, `type`, `title`, `message`, `channel`, `deliveryStatus`.
- Campos P: `payload`, `deduplicationKey`, `scheduledAt`, `sentAt`, `readAt`, `failureCode`, `deletedAt`.
- FKs: `userId -> User` (C).
- Índices/restrições: UK `(userId, deduplicationKey)` quando preenchido; IX `(userId, readAt, createdAt)`, `(deliveryStatus, scheduledAt)` e `(type, createdAt)`. Envio/leitura coerentes com estado.
- Exclusão/auditoria: soft delete e retenção por política; payload contém apenas o mínimo e nunca comprovante/token.

### `ScheduledJobLease` — grupo T

- Finalidade: concessão das tarefas automáticas, para cada uma rodar em um só servidor por intervalo (`DT-047`).
- Campos O: `name` (nome da tarefa), `holder` (servidor e processo), `lockedUntil`, `lastStartedAt`, `updatedAt`.
- Campos P: `lastFinishedAt`, `lastStatus` (`SUCCEEDED`, `FAILED`), `lastError` (só o tipo do erro, nunca a mensagem).
- Índices/restrições: UK `name`.
- Exclusão/auditoria: sem dado pessoal; uma linha por tarefa, reaproveitada a cada execução.

### `RateLimitBucket` — sem grupo comum

- Finalidade: contagem do limite de requisições compartilhada entre servidores (`DT-047`).
- Campos O: `key` (nome do limite e hash da rota com o IP; o endereço nunca fica em claro), `hits`, `windowEndsAt`.
- Campos P: `blockedUntil`.
- Índices/restrições: UK `key`; IX `windowEndsAt`; `CHECK hits >= 0`.
- Exclusão/auditoria: exclusão física pela limpeza a cada 10 minutos, assim que a janela e o bloqueio vencem.

## 10. Restrições físicas pendentes de migration

O Prisma expressa PKs, FKs, índices e grande parte das unicidades, mas não todos os `CHECK`, índices parciais ou proteções de imutabilidade. A primeira migration de cada módulo deverá implementar e testar, no mínimo:

1. valores e quantidades válidos, coerência de moedas e percentuais;
2. intervalos cronológicos e competência mensal;
3. XOR de proprietário do carrinho e de alvo de denúncia/moderação;
4. relação entre estado/origem e FKs em pagamento, obrigação e movimentação;
5. unicidade parcial que ignore registros com `deletedAt`;
6. duas pernas coerentes da transferência;
7. bloqueio de update/delete destrutivo em fatos financeiros confirmados;
8. uma mídia principal ativa por produto;
9. prevenção concorrente de slot de agenda e, após decisão, de sobreposição;
10. regras de produto digital reservado e de campanha aberta;
11. coerência entre método previsto da obrigação, método efetivo da transação e método do pagamento automático;
12. coerência cruzada entre produto, variante, campanha e movimento de estoque;
13. coerência entre parceiro do repasse e parceiro do item, e entre pedido do reembolso e pedido do pagamento;
14. autoridade de agenda/local e exclusividade/compatibilidade de tipo entre `Event`, `Tryout` e `Match`;
15. coerência de conta, moeda e período entre `CashClosing` e suas movimentações.

## 11. Auditoria mínima por classe

| Classe | Ações obrigatoriamente auditadas |
|---|---|
| Acesso/RBAC | login suspeito, revogação de sessão, concessão/revogação de papel ou permissão |
| Dados pessoais | leitura administrativa relevante, mudança de documento/contato/status, conversão e anonimização |
| Financeiro | criar, confirmar, conciliar, cancelar, reverter, reembolsar, fechar/reabrir e liquidar obrigação/repasse |
| Loja | preço/custo/comissão, ajuste de estoque, status de pedido/campanha e confirmação de retirada |
| Parceiros/agenda | aprovação, contrato/comissão, confirmação/cancelamento de atendimento e repasse |
| Conteúdo | publicar, editar material publicado, ocultar, fixar, fechar, restaurar e resolver denúncia |
| Configurações/arquivos | alteração institucional/bancária, upload, acesso sensível e remoção lógica |

Este dicionário deve permanecer sincronizado com `08-MODELO-DE-DADOS.md`, `diagramas/ERD.md` e `prisma/schema.prisma`.
