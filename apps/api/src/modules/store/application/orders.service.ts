import { Injectable } from '@nestjs/common';

import { OrderReader } from './order-view';
import { OrderCheckoutService } from './order-checkout.service';
import { GuestOrderAccessService } from './guest-order-access.service';
import { OrderPaymentsService } from './order-payments.service';
import { OrderStatusService } from './order-status.service';

export { personalizationOfItem } from './order-view';
export type {
  CheckoutInput,
  OrderCardHolder,
  OrderFilters,
  OrderItemView,
  OrderRow,
  OrderView,
  PixReceipt
} from './order-view';

/**
 * Pedidos da loja (RF-016 a RF-018, RF-029, DT-031). Fachada com os mesmos métodos de antes da
 * divisão (PEN-077): cada um repassa ao serviço do assunto — leitura (`OrderReader`), checkout,
 * pagamentos, situação e pedido sem conta. Os outros módulos continuam usando esta classe.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly reader: OrderReader,
    private readonly orderCheckout: OrderCheckoutService,
    private readonly guestAccess: GuestOrderAccessService,
    private readonly orderPayments: OrderPaymentsService,
    private readonly orderStatus: OrderStatusService
  ) {}

  /** Anexa dados de pagamento à visão do dono do pedido quando ainda há valor a pagar. */
  withPaymentInfo(
    ...args: Parameters<OrderReader['withPaymentInfo']>
  ): ReturnType<OrderReader['withPaymentInfo']> {
    return this.reader.withPaymentInfo(...args);
  }

  get(...args: Parameters<OrderReader['get']>): ReturnType<OrderReader['get']> {
    return this.reader.get(...args);
  }

  /**
   * Pedido na ficha da diretoria: inclui o titular do cartão pago pelo site (DT-100). Só a
   * rota da diretoria usa; respostas ao comprador usam `get`, sem esse campo.
   */
  getForStaff(
    ...args: Parameters<OrderReader['getForStaff']>
  ): ReturnType<OrderReader['getForStaff']> {
    return this.reader.getForStaff(...args);
  }

  /**
   * RF-017/RN-LOJ-007: revalida preço, disponibilidade e limites no servidor e cria o
   * pedido com itens congelados. Falha em qualquer item não cria pedido parcial.
   */
  checkout(
    ...args: Parameters<OrderCheckoutService['checkout']>
  ): ReturnType<OrderCheckoutService['checkout']> {
    return this.orderCheckout.checkout(...args);
  }

  list(...args: Parameters<OrderReader['list']>): ReturnType<OrderReader['list']> {
    return this.reader.list(...args);
  }

  mine(...args: Parameters<OrderReader['mine']>): ReturnType<OrderReader['mine']> {
    return this.reader.mine(...args);
  }

  getOwn(...args: Parameters<OrderReader['getOwn']>): ReturnType<OrderReader['getOwn']> {
    return this.reader.getOwn(...args);
  }

  /** Consulta segura de visitante: número + código secreto, resposta idêntica para erro. */
  guestLookup(
    ...args: Parameters<GuestOrderAccessService['guestLookup']>
  ): ReturnType<GuestOrderAccessService['guestLookup']> {
    return this.guestAccess.guestLookup(...args);
  }

  /**
   * Baixa automática do PIX do intermediário (DT-071): cria o pagamento e confirma no Caixa,
   * sem pessoa da diretoria. Só baixa se o pedido aguardava pagamento e o valor é o saldo;
   * caso contrário devolve o motivo e nada muda (a cobrança vai para revisão).
   */
  receivePixInTx(
    ...args: Parameters<OrderPaymentsService['receivePixInTx']>
  ): ReturnType<OrderPaymentsService['receivePixInTx']> {
    return this.orderPayments.receivePixInTx(...args);
  }

  /** Pagamento manual pela diretoria; com conta e permissão, confirma e lança no Caixa (RF-029). */
  recordPayment(
    ...args: Parameters<OrderPaymentsService['recordPayment']>
  ): ReturnType<OrderPaymentsService['recordPayment']> {
    return this.orderPayments.recordPayment(...args);
  }

  confirmPayment(
    ...args: Parameters<OrderPaymentsService['confirmPayment']>
  ): ReturnType<OrderPaymentsService['confirmPayment']> {
    return this.orderPayments.confirmPayment(...args);
  }

  /** Comprovante PIX do cliente (conta própria ou visitante com código). */
  submitProof(
    ...args: Parameters<OrderPaymentsService['submitProof']>
  ): ReturnType<OrderPaymentsService['submitProof']> {
    return this.orderPayments.submitProof(...args);
  }

  paymentAttachmentForOrder(
    ...args: Parameters<OrderPaymentsService['paymentAttachmentForOrder']>
  ): ReturnType<OrderPaymentsService['paymentAttachmentForOrder']> {
    return this.orderPayments.paymentAttachmentForOrder(...args);
  }

  changeStatus(
    ...args: Parameters<OrderStatusService['changeStatus']>
  ): ReturnType<OrderStatusService['changeStatus']> {
    return this.orderStatus.changeStatus(...args);
  }

  /** Cancelamento sistêmico (ex.: remessa cancelada): estorna pagamentos e libera reservas. */
  systemCancelInTx(
    ...args: Parameters<OrderStatusService['systemCancelInTx']>
  ): ReturnType<OrderStatusService['systemCancelInTx']> {
    return this.orderStatus.systemCancelInTx(...args);
  }

  /**
   * Chegada da remessa: pedido de retirada fica "pronto para retirada"; o de entrega em casa
   * vai para separação e o comprador é avisado de que a entrega vem a seguir (DT-075).
   */
  markReadyInTx(
    ...args: Parameters<OrderStatusService['markReadyInTx']>
  ): ReturnType<OrderStatusService['markReadyInTx']> {
    return this.orderStatus.markReadyInTx(...args);
  }

  /** Retirada rastreável: registra itens retirados e entrega o pedido (RN-REM-006). */
  markPickedUpInTx(
    ...args: Parameters<OrderStatusService['markPickedUpInTx']>
  ): ReturnType<OrderStatusService['markPickedUpInTx']> {
    return this.orderStatus.markPickedUpInTx(...args);
  }

  /**
   * Quem está logado traz para a conta um pedido feito sem conta, com o número e o código
   * (DT-096). Pedido já de outra conta não muda.
   */
  claimGuestOrder(
    ...args: Parameters<GuestOrderAccessService['claimGuestOrder']>
  ): ReturnType<GuestOrderAccessService['claimGuestOrder']> {
    return this.guestAccess.claimGuestOrder(...args);
  }

  /**
   * "Esqueci o código" (DT-096): reenvia o acesso (número, código e link fixo) dos pedidos sem
   * conta deste e-mail nos últimos 12 meses, até 10, pela fila de avisos. Não revela se o
   * e-mail comprou: quem chama recebe sempre a mesma resposta. Um reenvio por pedido por dia.
   */
  resendGuestAccess(
    ...args: Parameters<GuestOrderAccessService['resendGuestAccess']>
  ): ReturnType<GuestOrderAccessService['resendGuestAccess']> {
    return this.guestAccess.resendGuestAccess(...args);
  }

  /**
   * Quem comprou sem conta liga ou desliga os avisos do pedido por WhatsApp (DT-096, DT-048:
   * consentimento registrado e revogável). Desligar cancela os avisos ainda na fila.
   */
  setGuestWhatsapp(
    ...args: Parameters<GuestOrderAccessService['setGuestWhatsapp']>
  ): ReturnType<GuestOrderAccessService['setGuestWhatsapp']> {
    return this.guestAccess.setGuestWhatsapp(...args);
  }

  /**
   * O comprador cancela o próprio pedido enquanto não pagou (DT-076): sem comprovante em
   * análise. Depois de pago, vale a desistência em 7 dias (DT-070).
   */
  cancelByBuyer(
    ...args: Parameters<OrderStatusService['cancelByBuyer']>
  ): ReturnType<OrderStatusService['cancelByBuyer']> {
    return this.orderStatus.cancelByBuyer(...args);
  }

  /** Cancela pedidos aguardando pagamento com reserva vencida e sem comprovante (PEN-027). */
  expireStale(
    ...args: Parameters<OrderStatusService['expireStale']>
  ): ReturnType<OrderStatusService['expireStale']> {
    return this.orderStatus.expireStale(...args);
  }

  /** Vendas pagas no período (RF-020). */
  salesTotal(
    ...args: Parameters<OrderReader['salesTotal']>
  ): ReturnType<OrderReader['salesTotal']> {
    return this.reader.salesTotal(...args);
  }
}
