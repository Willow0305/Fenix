import { createHmac } from 'node:crypto';

import { crc16, mercadoPagoSignatureValid, sandboxBrCode } from './pix-provider';

describe('PIX automático (DT-071)', () => {
  const secret = 'segredo-de-teste';
  const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');

  it('aceita só aviso do Mercado Pago com assinatura correta', () => {
    const v1 = sign('id:123456;request-id:req-1;ts:1704908010;');
    const ok = {
      signatureHeader: `ts=1704908010,v1=${v1}`,
      requestId: 'req-1',
      dataId: '123456',
      secret
    };

    expect(mercadoPagoSignatureValid(ok)).toBe(true);
    expect(mercadoPagoSignatureValid({ ...ok, dataId: '999' })).toBe(false);
    expect(mercadoPagoSignatureValid({ ...ok, requestId: 'outro' })).toBe(false);
    expect(mercadoPagoSignatureValid({ ...ok, secret: 'errado' })).toBe(false);
    expect(mercadoPagoSignatureValid({ ...ok, signatureHeader: 'ts=1,v1=zz' })).toBe(false);
    expect(mercadoPagoSignatureValid({ ...ok, signatureHeader: undefined })).toBe(false);
  });

  it('id alfanumérico entra em minúsculas no manifesto', () => {
    const v1 = sign('id:abc123;request-id:r;ts:1;');

    expect(
      mercadoPagoSignatureValid({
        signatureHeader: `ts=1,v1=${v1}`,
        requestId: 'r',
        dataId: 'ABC123',
        secret
      })
    ).toBe(true);
  });

  it('CRC16 do BR Code confere com o valor de referência', () => {
    // Vetor clássico do CRC-16/CCITT-FALSE.
    expect(crc16('123456789')).toBe('29B1');
  });

  it('BR Code de teste tem valor, referência e CRC no fim', () => {
    const code = sandboxBrCode('115.00', 'abc-123');

    expect(code).toContain('5406115.00');
    expect(code).toContain('abc123');
    expect(code.slice(-8, -4)).toBe('6304');
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });
});
