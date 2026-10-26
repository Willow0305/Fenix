import { loadAppConfig } from '../config/app-config';
import { smtpDeliveryError } from '../mail/mail.service';
import { whatsappDeliveryError } from '../whatsapp/whatsapp.service';

describe('smtpDeliveryError', () => {
  it('recusa do destinatário é definitiva', () => {
    expect(smtpDeliveryError({ code: 'EENVELOPE', responseCode: 550 })).toMatchObject({
      code: 'SMTP_RECUSADO',
      permanent: true
    });
  });

  it('falha de conexão ou temporária tenta de novo', () => {
    expect(smtpDeliveryError({ code: 'ECONNECTION' })).toMatchObject({
      code: 'SMTP_INDISPONIVEL',
      permanent: false
    });
    expect(smtpDeliveryError({ responseCode: 421 })).toMatchObject({
      code: 'SMTP_421',
      permanent: false
    });
    expect(smtpDeliveryError({ code: 'EAUTH' }).permanent).toBe(false);
  });
});

describe('whatsappDeliveryError', () => {
  it('número sem WhatsApp e modelo recusado são definitivos', () => {
    expect(whatsappDeliveryError(400, { error: { code: 131026 } })).toMatchObject({
      code: 'WHATSAPP_131026',
      permanent: true
    });
    expect(whatsappDeliveryError(400, { error: { code: 132001 } }).permanent).toBe(true);
  });

  it('limite de envio e falha do servidor tentam de novo', () => {
    expect(whatsappDeliveryError(429, { error: { code: 130429 } }).permanent).toBe(false);
    expect(whatsappDeliveryError(503, null)).toMatchObject({
      code: 'WHATSAPP_HTTP_503',
      permanent: false
    });
  });
});

describe('configuração dos canais', () => {
  const base = { NODE_ENV: 'development' };

  it('fora de produção usa a caixa de saída local para e-mail e WhatsApp', () => {
    const config = loadAppConfig(base);

    expect(config.mailDriver).toBe('outbox');
    expect(config.whatsappDriver).toBe('outbox');
    expect(config.smtp).toBeNull();
  });

  it('lê o SMTP com STARTTLS na 587 e TLS direto na 465', () => {
    const smtp = { ...base, MAIL_DRIVER: 'smtp', SMTP_HOST: 'smtp.exemplo.com' };

    expect(loadAppConfig(smtp).smtp).toMatchObject({ port: 587, secure: false, user: null });
    expect(loadAppConfig({ ...smtp, SMTP_PORT: '465' }).smtp).toMatchObject({ secure: true });
    expect(() => loadAppConfig({ ...smtp, SMTP_USER: 'conta' })).toThrow(
      'Informe SMTP_USER e SMTP_PASSWORD juntos.'
    );
  });

  it('exige número e token para a WhatsApp Cloud API', () => {
    const cloud = { ...base, WHATSAPP_DRIVER: 'cloud' };

    expect(() => loadAppConfig(cloud)).toThrow('WHATSAPP_PHONE_NUMBER_ID');
    expect(
      loadAppConfig({
        ...cloud,
        WHATSAPP_PHONE_NUMBER_ID: '123456789012',
        WHATSAPP_ACCESS_TOKEN: 'token-de-teste'
      }).whatsappCloud
    ).toMatchObject({ templateName: 'fenix_aviso', templateLanguage: 'pt_BR' });
  });

  it('em produção o WhatsApp começa desligado e a caixa de saída local exige opt-in', () => {
    const production = {
      NODE_ENV: 'production',
      AUTH_ACCESS_TOKEN_SECRET: 'x'.repeat(40),
      DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
      WEB_ORIGIN: 'https://fenix.example',
      STORAGE_LOCAL_DIR: '/dados/storage'
    };

    expect(() => loadAppConfig(production)).toThrow('ALLOW_LOCAL_ADAPTERS_IN_PRODUCTION');
    expect(
      loadAppConfig({ ...production, ALLOW_LOCAL_ADAPTERS_IN_PRODUCTION: 'true' }).whatsappDriver
    ).toBe('off');
  });
});
