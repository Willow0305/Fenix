/**
 * Falha de envio por e-mail ou WhatsApp (DT-048). `code` é curto e sem dados pessoais,
 * porque vai para a fila de envios; `permanent` indica que não adianta tentar de novo
 * (destino recusado, modelo de mensagem inválido).
 */
export class DeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly permanent: boolean
  ) {
    super(`Falha de envio: ${code}.`);
    this.name = 'DeliveryError';
  }
}

export interface SendResult {
  readonly providerMessageId: string | null;
}
