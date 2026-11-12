import { Injectable } from '@nestjs/common';

import { MemberCardValidationService } from './member-card-validation.service';
import { MemberCardReader } from './member-card-view';
import { MemberCardAdminService } from './member-card-admin.service';
import { AffiliationCardsService } from './affiliation-cards.service';

export { boardActive } from './member-card-view';
export type {
  CardDesign,
  CardView,
  MyCardsView,
  CardQr,
  PublicValidation,
  StaffValidation,
  CardAdminRow,
  MembershipPlanRow,
  CardsOverview,
  CardAdminDetail,
  CardRow,
  CardFeeRule
} from './member-card-view';

/**
 * Carteirinhas digitais de atleta, diretoria e afiliado (DT-068). Fachada com os mesmos métodos
 * de antes da divisão (PEN-077): cada um repassa ao serviço do assunto — leitura
 * (`MemberCardReader`), QR e validação, afiliação e painel. Os outros módulos continuam usando
 * esta classe.
 */
@Injectable()
export class CardsService {
  constructor(
    private readonly validation: MemberCardValidationService,
    private readonly reader: MemberCardReader,
    private readonly admin: MemberCardAdminService,
    private readonly affiliations: AffiliationCardsService
  ) {}

  purgeChecks(
    ...args: Parameters<MemberCardValidationService['purgeChecks']>
  ): ReturnType<MemberCardValidationService['purgeChecks']> {
    return this.validation.purgeChecks(...args);
  }

  design(...args: Parameters<MemberCardReader['design']>): ReturnType<MemberCardReader['design']> {
    return this.reader.design(...args);
  }

  setDesign(
    ...args: Parameters<MemberCardAdminService['setDesign']>
  ): ReturnType<MemberCardAdminService['setDesign']> {
    return this.admin.setDesign(...args);
  }

  /** Dias de tolerância depois do vencimento antes de suspender a carteirinha de atleta. */
  feeToleranceDays(
    ...args: Parameters<MemberCardReader['feeToleranceDays']>
  ): ReturnType<MemberCardReader['feeToleranceDays']> {
    return this.reader.feeToleranceDays(...args);
  }

  feeRule(
    ...args: Parameters<MemberCardReader['feeRule']>
  ): ReturnType<MemberCardReader['feeRule']> {
    return this.reader.feeRule(...args);
  }

  setFeeRule(
    ...args: Parameters<MemberCardAdminService['setFeeRule']>
  ): ReturnType<MemberCardAdminService['setFeeRule']> {
    return this.admin.setFeeRule(...args);
  }

  /**
   * Registra quando a carteirinha de atleta passa a ficar suspensa por atraso ou volta a
   * valer (DT-101): auditoria e aviso ao atleta, uma vez por mudança. A situação em si é
   * sempre calculada na hora (pagou, voltou); esta rotina só marca a passagem.
   */
  syncFeeBlocks(
    ...args: Parameters<MemberCardAdminService['syncFeeBlocks']>
  ): ReturnType<MemberCardAdminService['syncFeeBlocks']> {
    return this.admin.syncFeeBlocks(...args);
  }

  /** Atleta ativo sem carteirinha ganha uma (gratuita, DT-068 A). */
  /** Carteirinhas gratuitas: atletas ativos e quem tem o papel Diretoria (DT-068, DT-077). */
  ensureFreeCards(
    ...args: Parameters<MemberCardReader['ensureFreeCards']>
  ): ReturnType<MemberCardReader['ensureFreeCards']> {
    return this.reader.ensureFreeCards(...args);
  }

  /**
   * Diretoria (DT-077): uma carteirinha por pessoa com o papel Diretoria e conta ativa, criada
   * na primeira vez; se a pessoa sai da diretoria ela deixa de valer (e volta se o papel voltar).
   */
  ensureBoardCards(
    ...args: Parameters<MemberCardReader['ensureBoardCards']>
  ): ReturnType<MemberCardReader['ensureBoardCards']> {
    return this.reader.ensureBoardCards(...args);
  }

  ensureAthleteCards(
    ...args: Parameters<MemberCardReader['ensureAthleteCards']>
  ): ReturnType<MemberCardReader['ensureAthleteCards']> {
    return this.reader.ensureAthleteCards(...args);
  }

  myCards(
    ...args: Parameters<MemberCardReader['myCards']>
  ): ReturnType<MemberCardReader['myCards']> {
    return this.reader.myCards(...args);
  }

  /** QR do celular: muda a cada minuto; só para carteirinha válida. */
  liveQr(
    ...args: Parameters<MemberCardValidationService['liveQr']>
  ): ReturnType<MemberCardValidationService['liveQr']> {
    return this.validation.liveQr(...args);
  }

  /** QR fixo do impresso: vale até a próxima reemissão (DT-068, impressão). */
  printed(
    ...args: Parameters<MemberCardValidationService['printed']>
  ): ReturnType<MemberCardValidationService['printed']> {
    return this.validation.printed(...args);
  }

  /** Quem confere sem login (parceiro): o mínimo para conferir e os benefícios (DT-068 C). */
  validatePublic(
    ...args: Parameters<MemberCardValidationService['validatePublic']>
  ): ReturnType<MemberCardValidationService['validatePublic']> {
    return this.validation.validatePublic(...args);
  }

  /** Diretoria logada: situação completa e, com permissão, mensalidade em dia. */
  validateStaff(
    ...args: Parameters<MemberCardValidationService['validateStaff']>
  ): ReturnType<MemberCardValidationService['validateStaff']> {
    return this.validation.validateStaff(...args);
  }

  /**
   * Pedido pago: cria uma carteirinha de afiliado por beneficiário, ou soma o período à
   * carteirinha renovada. Roda uma vez por item (marca `activatedAt` nos detalhes).
   */
  activateAffiliationsInTx(
    ...args: Parameters<AffiliationCardsService['activateAffiliationsInTx']>
  ): ReturnType<AffiliationCardsService['activateAffiliationsInTx']> {
    return this.affiliations.activateAffiliationsInTx(...args);
  }

  /**
   * Pedido cancelado ou estornado: carteirinhas criadas por ele são canceladas e a
   * renovação volta à data anterior (se ninguém mexeu depois).
   */
  cancelAffiliationsInTx(
    ...args: Parameters<AffiliationCardsService['cancelAffiliationsInTx']>
  ): ReturnType<AffiliationCardsService['cancelAffiliationsInTx']> {
    return this.affiliations.cancelAffiliationsInTx(...args);
  }

  /** Desistência de uma afiliação (DT-070): as carteirinhas daquele item são canceladas. */
  cancelByOrderItemInTx(
    ...args: Parameters<AffiliationCardsService['cancelByOrderItemInTx']>
  ): ReturnType<AffiliationCardsService['cancelByOrderItemInTx']> {
    return this.affiliations.cancelByOrderItemInTx(...args);
  }

  /** Aviso 15 dias antes de a afiliação vencer, uma vez por data final. */
  noticeExpiring(
    ...args: Parameters<AffiliationCardsService['noticeExpiring']>
  ): ReturnType<AffiliationCardsService['noticeExpiring']> {
    return this.affiliations.noticeExpiring(...args);
  }

  /** Avisa todas as contas ativas que a afiliação está à venda, uma vez por produto. */
  announceMembership(
    ...args: Parameters<AffiliationCardsService['announceMembership']>
  ): ReturnType<AffiliationCardsService['announceMembership']> {
    return this.affiliations.announceMembership(...args);
  }

  /** Visão geral da aba Afiliação: números, planos e benefícios (DT-072). */
  overview(
    ...args: Parameters<MemberCardAdminService['overview']>
  ): ReturnType<MemberCardAdminService['overview']> {
    return this.admin.overview(...args);
  }

  list(
    ...args: Parameters<MemberCardAdminService['list']>
  ): ReturnType<MemberCardAdminService['list']> {
    return this.admin.list(...args);
  }

  detail(
    ...args: Parameters<MemberCardAdminService['detail']>
  ): ReturnType<MemberCardAdminService['detail']> {
    return this.admin.detail(...args);
  }

  /** Suspender, reativar, cancelar, reemitir, estender ou corrigir nome; sempre com motivo. */
  change(
    ...args: Parameters<MemberCardAdminService['change']>
  ): ReturnType<MemberCardAdminService['change']> {
    return this.admin.change(...args);
  }
}
