import { Injectable } from '@nestjs/common';

export type StorageDriver = 'local';
export type MailDriver = 'outbox';

/**
 * Configuração tipada lida do ambiente. Fora de produção existem padrões inertes para
 * permitir testes e desenvolvimento; em produção os segredos são obrigatórios.
 */
export interface AppConfigValues {
  readonly nodeEnv: string;
  readonly isProduction: boolean;
  readonly webOrigin: string;
  readonly accessTokenSecret: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly dataEncryptionKey: Buffer;
  readonly storageDriver: StorageDriver;
  readonly storageLocalDir: string;
  readonly mailDriver: MailDriver;
  readonly mailOutboxDir: string;
  readonly mailFrom: string;
  readonly allowLocalAdaptersInProduction: boolean;
}

const DEV_ACCESS_SECRET = 'development-only-access-token-secret-change-me';
const DEV_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

function readString(env: NodeJS.ProcessEnv, key: string, fallback: string | undefined): string {
  const value = env[key];

  if (value !== undefined && value.trim() !== '') {
    return value.trim();
  }

  if (fallback === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}.`);
  }

  return fallback;
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfigValues {
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  const isProduction = nodeEnv === 'production';
  const devFallback = <T>(value: T): T | undefined => (isProduction ? undefined : value);

  const accessTokenSecret = readString(
    env,
    'AUTH_ACCESS_TOKEN_SECRET',
    devFallback(DEV_ACCESS_SECRET)
  );

  if (accessTokenSecret.length < 32) {
    throw new Error('AUTH_ACCESS_TOKEN_SECRET deve ter ao menos 32 caracteres.');
  }

  const rawKey = readString(env, 'DATA_ENCRYPTION_KEY', devFallback(DEV_ENCRYPTION_KEY));
  const dataEncryptionKey = Buffer.from(rawKey, 'base64');

  if (dataEncryptionKey.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY deve conter 32 bytes em base64.');
  }

  const storageDriver = readString(env, 'STORAGE_DRIVER', 'local');
  const mailDriver = readString(env, 'MAIL_DRIVER', 'outbox');

  if (storageDriver !== 'local') {
    throw new Error('STORAGE_DRIVER suportado: local.');
  }

  if (mailDriver !== 'outbox') {
    throw new Error('MAIL_DRIVER suportado: outbox.');
  }

  const allowLocalAdaptersInProduction = env['ALLOW_LOCAL_ADAPTERS_IN_PRODUCTION'] === 'true';

  if (isProduction && !allowLocalAdaptersInProduction) {
    throw new Error(
      'Adaptadores locais de arquivo e e-mail não são permitidos em produção sem ALLOW_LOCAL_ADAPTERS_IN_PRODUCTION=true.'
    );
  }

  return {
    nodeEnv,
    isProduction,
    webOrigin: readString(env, 'WEB_ORIGIN', devFallback('http://localhost:3000')),
    accessTokenSecret,
    accessTokenTtlSeconds: 15 * 60,
    refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
    dataEncryptionKey,
    storageDriver,
    storageLocalDir: readString(env, 'STORAGE_LOCAL_DIR', 'var/storage'),
    mailDriver,
    mailOutboxDir: readString(env, 'MAIL_OUTBOX_DIR', 'var/mail-outbox'),
    mailFrom: readString(env, 'MAIL_FROM', 'Fênix Vôlei <nao-responda@fenix.example>'),
    allowLocalAdaptersInProduction
  };
}

@Injectable()
export class AppConfig {
  readonly values: AppConfigValues = loadAppConfig();
}
