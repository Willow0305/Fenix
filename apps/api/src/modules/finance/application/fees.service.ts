import { Injectable } from '@nestjs/common';

import { FeePlansService } from './fee-plans.service';
import { FeeChargesService } from './fee-charges.service';
import { FeeReader } from './fee-view';
import { FeePaymentsService } from './fee-payments.service';

export { cancellablePlanFees, paidOf, monthOf } from './fee-view';
export type {
  PlanView,
  PlanEndEffects,
  PlanImpact,
  AthletePlanView,
  PlanMemberView,
  BulkAssignResult,
  PlanRow,
  FeeView,
  FeeDetail,
  FeeFilters,
  FeeRow
} from './fee-view';

/**
 * Mensalidades (RF-011 a RF-013, DT-027). Fachada com os mesmos métodos de antes da divisão
 * (PEN-077): cada um repassa ao serviço do assunto — leitura (`FeeReader`), planos, cobranças
 * e pagamentos. Os outros módulos continuam usando esta classe.
 */
@Injectable()
export class FeesService {
  constructor(
    private readonly feePlans: FeePlansService,
    private readonly feeCharges: FeeChargesService,
    private readonly reader: FeeReader,
    private readonly feePayments: FeePaymentsService
  ) {}

  plans(...args: Parameters<FeePlansService['plans']>): ReturnType<FeePlansService['plans']> {
    return this.feePlans.plans(...args);
  }

  createPlan(
    ...args: Parameters<FeePlansService['createPlan']>
  ): ReturnType<FeePlansService['createPlan']> {
    return this.feePlans.createPlan(...args);
  }

  /** RN-MEN-001: alterar ou inativar plano não altera cobranças já geradas. */
  updatePlan(
    ...args: Parameters<FeePlansService['updatePlan']>
  ): ReturnType<FeePlansService['updatePlan']> {
    return this.feePlans.updatePlan(...args);
  }

  /** Impacto de inativar ou excluir o plano (DT-066), para o diálogo de confirmação. */
  planImpact(
    ...args: Parameters<FeePlansService['planImpact']>
  ): ReturnType<FeePlansService['planImpact']> {
    return this.feePlans.planImpact(...args);
  }

  /**
   * Efeitos de encerrar um plano, no mesmo instante e com o mesmo motivo. Nunca cancela
   * mensalidade com pagamento nem de mês passado (dívida real); cada mudança é auditada.
   */
  applyPlanEndEffects(
    ...args: Parameters<FeePlansService['applyPlanEndEffects']>
  ): ReturnType<FeePlansService['applyPlanEndEffects']> {
    return this.feePlans.applyPlanEndEffects(...args);
  }

  athletePlans(
    ...args: Parameters<FeePlansService['athletePlans']>
  ): ReturnType<FeePlansService['athletePlans']> {
    return this.feePlans.athletePlans(...args);
  }

  assignPlan(
    ...args: Parameters<FeePlansService['assignPlan']>
  ): ReturnType<FeePlansService['assignPlan']> {
    return this.feePlans.assignPlan(...args);
  }

  /** Atletas do plano: vigentes primeiro, depois o histórico (COR-021). */
  planMembers(
    ...args: Parameters<FeePlansService['planMembers']>
  ): ReturnType<FeePlansService['planMembers']> {
    return this.feePlans.planMembers(...args);
  }

  /** Coloca vários atletas no plano de uma vez; cada um vira uma atribuição auditada. */
  assignMany(
    ...args: Parameters<FeePlansService['assignMany']>
  ): ReturnType<FeePlansService['assignMany']> {
    return this.feePlans.assignMany(...args);
  }

  /**
   * Exclusão lógica do plano (DT-066). Plano excluído não pode continuar cobrando: as
   * mensalidades do mês atual em diante sem pagamento são canceladas e os vínculos vigentes
   * terminam hoje. Meses passados e cobranças com pagamento continuam (dívida real).
   */
  deletePlan(
    ...args: Parameters<FeePlansService['deletePlan']>
  ): ReturnType<FeePlansService['deletePlan']> {
    return this.feePlans.deletePlan(...args);
  }

  endPlan(...args: Parameters<FeePlansService['endPlan']>): ReturnType<FeePlansService['endPlan']> {
    return this.feePlans.endPlan(...args);
  }

  /**
   * RF-012: gera cobranças para atletas ativos com plano vigente no mês. A chave
   * única atleta+mês garante que repetir a geração não duplica (RN-MEN-003).
   */
  generate(
    ...args: Parameters<FeeChargesService['generate']>
  ): ReturnType<FeeChargesService['generate']> {
    return this.feeCharges.generate(...args);
  }

  list(...args: Parameters<FeeReader['list']>): ReturnType<FeeReader['list']> {
    return this.reader.list(...args);
  }

  get(...args: Parameters<FeeReader['get']>): ReturnType<FeeReader['get']> {
    return this.reader.get(...args);
  }

  /**
   * Baixa automática do PIX da mensalidade (DT-071), sem pessoa da diretoria. Não baixa
   * mensalidade cancelada nem valor acima do saldo: devolve o motivo para revisão.
   */
  receivePixInTx(
    ...args: Parameters<FeePaymentsService['receivePixInTx']>
  ): ReturnType<FeePaymentsService['receivePixInTx']> {
    return this.feePayments.receivePixInTx(...args);
  }

  /** Saldo em aberto que ainda pode ser cobrado (sem contar pagamentos pendentes). */
  outstandingInTx(
    ...args: Parameters<FeePaymentsService['outstandingInTx']>
  ): ReturnType<FeePaymentsService['outstandingInTx']> {
    return this.feePayments.outstandingInTx(...args);
  }

  /**
   * RF-013: registra pagamento manual. Com `accountId` e permissão de confirmação,
   * confirma e lança no Caixa na mesma transação; caso contrário fica pendente.
   */
  recordPayment(
    ...args: Parameters<FeePaymentsService['recordPayment']>
  ): ReturnType<FeePaymentsService['recordPayment']> {
    return this.feePayments.recordPayment(...args);
  }

  /** Confirma pagamento pendente (ex.: comprovante PIX enviado pelo atleta). */
  confirmPayment(
    ...args: Parameters<FeePaymentsService['confirmPayment']>
  ): ReturnType<FeePaymentsService['confirmPayment']> {
    return this.feePayments.confirmPayment(...args);
  }

  /** RN-MEN-007: pendente é cancelado; confirmado gera estorno vinculado. */
  reversePayment(
    ...args: Parameters<FeePaymentsService['reversePayment']>
  ): ReturnType<FeePaymentsService['reversePayment']> {
    return this.feePayments.reversePayment(...args);
  }

  /** Desconto/isenção manual e motivado (DT-027); total não fica abaixo do já pago. */
  adjust(
    ...args: Parameters<FeeChargesService['adjust']>
  ): ReturnType<FeeChargesService['adjust']> {
    return this.feeCharges.adjust(...args);
  }

  /** Muda o vencimento de uma cobrança em aberto (COR-021); o atraso é recalculado na leitura. */
  changeDueDate(
    ...args: Parameters<FeeChargesService['changeDueDate']>
  ): ReturnType<FeeChargesService['changeDueDate']> {
    return this.feeCharges.changeDueDate(...args);
  }

  cancel(
    ...args: Parameters<FeeChargesService['cancel']>
  ): ReturnType<FeeChargesService['cancel']> {
    return this.feeCharges.cancel(...args);
  }

  mine(...args: Parameters<FeeReader['mine']>): ReturnType<FeeReader['mine']> {
    return this.reader.mine(...args);
  }

  /** Atleta envia comprovante PIX; fica pendente até a diretoria confirmar. */
  submitProof(
    ...args: Parameters<FeePaymentsService['submitProof']>
  ): ReturnType<FeePaymentsService['submitProof']> {
    return this.feePayments.submitProof(...args);
  }

  /** Comprovante de pagamento: dono do pagamento ou quem tem `fees.read`. */
  paymentAttachment(
    ...args: Parameters<FeePaymentsService['paymentAttachment']>
  ): ReturnType<FeePaymentsService['paymentAttachment']> {
    return this.feePayments.paymentAttachment(...args);
  }

  /** Totais para o painel (RF-020). */
  openSummary(...args: Parameters<FeeReader['openSummary']>): ReturnType<FeeReader['openSummary']> {
    return this.reader.openSummary(...args);
  }
}
