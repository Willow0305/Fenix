import { Injectable } from '@nestjs/common';

type RuntimeEnvironment = 'development' | 'test' | 'staging' | 'production';

function readRuntimeEnvironment(): RuntimeEnvironment {
  const value = process.env['APP_ENV'] ?? process.env['NODE_ENV'] ?? 'development';

  if (!['development', 'test', 'staging', 'production'].includes(value)) {
    throw new Error('APP_ENV deve ser development, test, staging ou production.');
  }

  return value as RuntimeEnvironment;
}

function requireText(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} é obrigatória neste ambiente.`);
  }

  return value;
}

function requireEmail(name: string): string {
  const value = requireText(name);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
    throw new Error(`${name} deve ser um endereço de e-mail válido.`);
  }

  return value;
}

@Injectable()
export class ApplicationConfig {
  public readonly environment = readRuntimeEnvironment();
  public readonly isProduction = this.environment === 'production';
  public readonly isProductionLike =
    this.environment === 'production' || this.environment === 'staging';
  public readonly realMinorDataEnabled = process.env['REAL_MINOR_DATA_ENABLED'] === 'true';
  public readonly healthDataCollectionEnabled = false;
  public readonly sportsDuplicateHmacKey: string;

  public constructor() {
    if (process.env['HEALTH_DATA_COLLECTION_ENABLED'] === 'true') {
      throw new Error('A coleta de dados de saúde é proibida no escopo vigente.');
    }

    if (this.realMinorDataEnabled) {
      throw new Error(
        'REAL_MINOR_DATA_ENABLED não pode ser habilitada enquanto o gate LGPD/ECA Digital estiver bloqueado.'
      );
    }

    if (!this.isProductionLike) {
      const duplicateHmacKey =
        process.env['SPORTS_DUPLICATE_HMAC_KEY'] ?? 'fenix-local-sports-duplicate-hmac-key-v1';

      if (Buffer.byteLength(duplicateHmacKey, 'utf8') < 32) {
        throw new Error('SPORTS_DUPLICATE_HMAC_KEY deve possuir ao menos 32 bytes.');
      }

      this.sportsDuplicateHmacKey = duplicateHmacKey;
      return;
    }

    requireText('RESPONSIBLE_TECHNOLOGY');
    requireText('RESPONSIBLE_PRIVACY');
    requireText('RESPONSIBLE_SECURITY');
    requireEmail('SECURITY_CONTACT_EMAIL');
    requireEmail('PRIVACY_CONTACT_EMAIL');
    requireText('REDIS_URL');
    const duplicateHmacKey = requireText('SPORTS_DUPLICATE_HMAC_KEY');

    if (Buffer.byteLength(duplicateHmacKey, 'utf8') < 32) {
      throw new Error('SPORTS_DUPLICATE_HMAC_KEY deve possuir ao menos 32 bytes.');
    }

    this.sportsDuplicateHmacKey = duplicateHmacKey;

    if (process.env['EMAIL_DELIVERY_MODE'] !== 'smtp') {
      throw new Error('EMAIL_DELIVERY_MODE deve ser smtp em staging e produção.');
    }

    requireText('SMTP_HOST');
    requireEmail('SMTP_FROM');

    if (this.isProduction && process.env['PRODUCTION_RELEASE_APPROVED'] !== 'true') {
      throw new Error(
        'Produção bloqueada: PRODUCTION_RELEASE_APPROVED exige aprovação institucional explícita.'
      );
    }
  }
}
