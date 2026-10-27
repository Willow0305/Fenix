import { MercadoPagoPixProvider } from './pix-providers';

describe('conector do Mercado Pago (DT-071)', () => {
  const original = global.fetch;
  let calls: { url: string; init: RequestInit }[] = [];

  function respond(body: unknown, ok = true) {
    global.fetch = ((url: string, init: RequestInit) => {
      calls.push({ url, init });

      return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
    }) as typeof fetch;
  }

  beforeEach(() => {
    calls = [];
  });

  afterAll(() => {
    global.fetch = original;
  });

  it('cria a cobrança PIX com idempotência, validade e aviso', async () => {
    respond({
      id: 123,
      status: 'pending',
      date_of_expiration: '2026-10-28T12:00:00.000Z',
      point_of_interaction: { transaction_data: { qr_code: '000201...' } }
    });

    const provider = new MercadoPagoPixProvider('token-teste', 'https://exemplo.test/webhook');
    const created = await provider.createCharge({
      amount: '70.00',
      description: 'Pedido FNX',
      externalReference: 'ref-1',
      expiresAt: new Date('2026-10-28T12:00:00.000Z'),
      payerEmail: 'ana@exemplo.test',
      idempotencyKey: 'ref-1'
    });
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    const headers = calls[0]?.init.headers as Record<string, string>;

    expect(created).toMatchObject({ providerChargeId: '123', qrCode: '000201...' });
    expect(calls[0]?.url).toBe('https://api.mercadopago.com/v1/payments');
    expect(headers['X-Idempotency-Key']).toBe('ref-1');
    expect(headers['Authorization']).toBe('Bearer token-teste');
    expect(body).toMatchObject({
      transaction_amount: 70,
      payment_method_id: 'pix',
      external_reference: 'ref-1',
      notification_url: 'https://exemplo.test/webhook'
    });
  });

  it('lê a situação: aprovado, vencido, cancelado e pendente', async () => {
    const provider = new MercadoPagoPixProvider('token-teste', null);

    respond({
      id: 1,
      status: 'approved',
      transaction_amount: 70,
      date_approved: '2026-10-27T10:00:00Z'
    });
    await expect(provider.fetchStatus('1')).resolves.toMatchObject({
      status: 'PAID',
      paidAmount: '70.00'
    });
    respond({ id: 1, status: 'cancelled', status_detail: 'expired' });
    await expect(provider.fetchStatus('1')).resolves.toMatchObject({ status: 'EXPIRED' });
    respond({ id: 1, status: 'cancelled', status_detail: 'by_collector' });
    await expect(provider.fetchStatus('1')).resolves.toMatchObject({ status: 'CANCELLED' });
    respond({ id: 1, status: 'pending' });
    await expect(provider.fetchStatus('1')).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('falha do intermediário vira "indisponível", sem expor o token', async () => {
    respond({ message: 'erro' }, false);

    const provider = new MercadoPagoPixProvider('token-secreto', null);

    await expect(provider.fetchStatus('1')).rejects.toMatchObject({ code: 'PIX_UNAVAILABLE' });
    await provider.fetchStatus('1').catch((error: Error) => {
      expect(error.message).not.toContain('token-secreto');
    });
  });
});
