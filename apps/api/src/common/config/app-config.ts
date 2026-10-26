import { isAbsolute } from 'node:path';

import { Injectable } from '@nestjs/common';

export type StorageDriver = 'local' | 's3';
export type MailDriver = 'outbox' | 'smtp';
/** `off` desliga o canal; `outbox` grava em arquivo (teste); `cloud` envia pela Meta (DT-048). */
export type WhatsAppDriver = 'off' | 'outbox' | 'cloud';

export interface S3StorageConfig {
  readonly bucket: string;
  readonly region: string;
  /** Endereço do serviço compatível (MinIO, R2…); vazio usa a AWS. */
  readonly endpoint: string | null;
  readonly forcePathStyle: boolean;
  /** Sem chaves, usa as credenciais do ambiente (ex.: papel da máquina na AWS). */
  readonly accessKeyId: string | null;
  readonly secretAccessKey: string | null;
  /** Criptografia no servidor do provedor (AES-256); desligue só se ele não suportar. */
  readonly serverSideEncryption: boolean;
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  /** TLS desde a conexão (porta 465); `false` usa STARTTLS obrigatório. */
  readonly secure: boolean;
  readonly user: string | null;
  readonly password: string | null;
}

export interface WhatsAppCloudConfig {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  /** Modelo de mensagem aprovado na Meta, com 4 variáveis: nome, título, texto e link. */
  readonly templateName: string;
  readonly templateLanguage: string;
  readonly apiVersion: string;
}

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
  readonly dataEncryptionKey: Buffer;
  readonly storageDriver: StorageDriver;
  readonly storageLocalDir: string;
  readonly s3: S3StorageConfig | null;
  readonly mailDriver: MailDriver;
  readonly mailOutboxDir: string;
  readonly mailFrom: string;
  readonly smtp: SmtpConfig | null;
  readonly whatsappDriver: WhatsAppDriver;
  readonly whatsappOutboxDir: string;
  readonly whatsappCloud: WhatsAppCloudConfig | null;
  readonly allowLocalAdaptersInProduction: boolean;
  /** Proxies confiáveis para o IP real (`trust proxy` do Express). */
  readonly trustProxy: string;
  /** Rota do site que descarta o cache das páginas públicas (DT-041); null desliga. */
  readonly siteRevalidate: { readonly url: string; readonly secret: string } | null;
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

/**
 * Quem pode informar o IP real. Aceita os nomes do Express (`loopback`, `uniquelocal`…),
 * IPs e faixas CIDR separados por vírgula. Padrão: só a própria máquina.
 */
export function loadTrustProxy(env: NodeJS.ProcessEnv): string {
  const value = readString(env, 'TRUST_PROXY', 'loopback');

  if (!/^[a-z0-9.:/]+(\s*,\s*[a-z0-9.:/]+)*$/i.test(value)) {
    throw new Error('TRUST_PROXY inválido: use nomes (loopback, uniquelocal), IPs ou faixas CIDR.');
  }

  return value;
}

/** Serviço na rede interna (nome de contêiner ou IP privado): o tráfego não sai da máquina. */
export function isInternalHost(url: string): boolean {
  const host = new URL(url).hostname;

  return !host.includes('.') || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

/** Configuração S3; também usada pelo comando de migração dos arquivos locais. */
export function loadS3(env: NodeJS.ProcessEnv, isProduction: boolean): S3StorageConfig {
  const endpoint = env['S3_ENDPOINT']?.trim() || null;

  if (endpoint && isProduction && !endpoint.startsWith('https://') && !isInternalHost(endpoint)) {
    throw new Error('Em produção, S3_ENDPOINT público deve usar https://.');
  }

  const accessKeyId = env['S3_ACCESS_KEY_ID']?.trim() || null;
  const secretAccessKey = env['S3_SECRET_ACCESS_KEY'] || null;

  if ((accessKeyId === null) !== (secretAccessKey === null)) {
    throw new Error('Informe S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY juntos.');
  }

  return {
    bucket: readString(env, 'S3_BUCKET', undefined),
    region: readString(env, 'S3_REGION', 'us-east-1'),
    endpoint,
    forcePathStyle: readString(env, 'S3_FORCE_PATH_STYLE', endpoint ? 'true' : 'false') === 'true',
    accessKeyId,
    secretAccessKey,
    serverSideEncryption: env['S3_SERVER_SIDE_ENCRYPTION'] !== 'off'
  };
}

function loadSmtp(env: NodeJS.ProcessEnv): SmtpConfig {
  const port = Number(readString(env, 'SMTP_PORT', '587'));

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('SMTP_PORT inválida.');
  }

  const user = env['SMTP_USER']?.trim() || null;
  const password = env['SMTP_PASSWORD'] || null;

  if ((user === null) !== (password === null)) {
    throw new Error('Informe SMTP_USER e SMTP_PASSWORD juntos.');
  }

  return {
    host: readString(env, 'SMTP_HOST', undefined),
    port,
    secure: readString(env, 'SMTP_SECURE', port === 465 ? 'true' : 'false') === 'true',
    user,
    password
  };
}

function loadWhatsAppCloud(env: NodeJS.ProcessEnv): WhatsAppCloudConfig {
  const phoneNumberId = readString(env, 'WHATSAPP_PHONE_NUMBER_ID', undefined);
  const apiVersion = readString(env, 'WHATSAPP_API_VERSION', 'v23.0');

  if (!/^\d{5,30}$/.test(phoneNumberId)) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID deve conter só números.');
  }

  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new Error('WHATSAPP_API_VERSION deve ter o formato v23.0.');
  }

  return {
    phoneNumberId,
    accessToken: readString(env, 'WHATSAPP_ACCESS_TOKEN', undefined),
    templateName: readString(env, 'WHATSAPP_TEMPLATE_NAME', 'fenix_aviso'),
    templateLanguage: readString(env, 'WHATSAPP_TEMPLATE_LANGUAGE', 'pt_BR'),
    apiVersion
  };
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

  if (storageDriver !== 'local' && storageDriver !== 's3') {
    throw new Error('STORAGE_DRIVER suportado: local ou s3.');
  }

  if (mailDriver !== 'outbox' && mailDriver !== 'smtp') {
    throw new Error('MAIL_DRIVER suportado: outbox ou smtp.');
  }

  const whatsappDriver = readString(env, 'WHATSAPP_DRIVER', isProduction ? 'off' : 'outbox');

  if (whatsappDriver !== 'off' && whatsappDriver !== 'outbox' && whatsappDriver !== 'cloud') {
    throw new Error('WHATSAPP_DRIVER suportado: off, outbox ou cloud.');
  }

  const smtp = mailDriver === 'smtp' ? loadSmtp(env) : null;
  const whatsappCloud = whatsappDriver === 'cloud' ? loadWhatsAppCloud(env) : null;
  const allowLocalAdaptersInProduction = env['ALLOW_LOCAL_ADAPTERS_IN_PRODUCTION'] === 'true';
  const storageLocalDir = readString(env, 'STORAGE_LOCAL_DIR', 'var/storage');

  // Em produção os arquivos vivem num volume persistente, nunca na pasta da aplicação.
  if (isProduction && storageDriver === 'local' && !isAbsolute(storageLocalDir)) {
    throw new Error(
      'Em produção, STORAGE_LOCAL_DIR deve ser um caminho absoluto (volume persistente).'
    );
  }

  // Arquivos ainda só têm adaptador local; e-mail e WhatsApp em arquivo não entregam nada.
  const usesLocalAdapter =
    storageDriver === 'local' || mailDriver === 'outbox' || whatsappDriver === 'outbox';

  if (isProduction && usesLocalAdapter && !allowLocalAdaptersInProduction) {
    throw new Error(
      'Adaptadores locais de arquivo, e-mail ou WhatsApp não são permitidos em produção sem ALLOW_LOCAL_ADAPTERS_IN_PRODUCTION=true.'
    );
  }

  return {
    nodeEnv,
    isProduction,
    webOrigin: readString(env, 'WEB_ORIGIN', devFallback('http://localhost:3000')),
    accessTokenSecret,
    accessTokenTtlSeconds: 15 * 60,
    dataEncryptionKey,
    storageDriver,
    storageLocalDir,
    s3: storageDriver === 's3' ? loadS3(env, isProduction) : null,
    mailDriver,
    mailOutboxDir: readString(env, 'MAIL_OUTBOX_DIR', 'var/mail-outbox'),
    mailFrom: readString(env, 'MAIL_FROM', 'Fênix Vôlei <nao-responda@fenix.example>'),
    smtp,
    whatsappDriver,
    whatsappOutboxDir: readString(env, 'WHATSAPP_OUTBOX_DIR', 'var/whatsapp-outbox'),
    whatsappCloud,
    siteRevalidate: env['SITE_REVALIDATE_SECRET']
      ? {
          url: `${readString(env, 'WEB_INTERNAL_URL', 'http://127.0.0.1:3000')}/api/site-revalidate`,
          secret: env['SITE_REVALIDATE_SECRET']
        }
      : null,
    allowLocalAdaptersInProduction,
    trustProxy: loadTrustProxy(env)
  };
}

@Injectable()
export class AppConfig {
  readonly values: AppConfigValues = loadAppConfig();
}
