import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { AuthConfig } from './auth.config';

interface EncryptedSecret {
  readonly secretCiphertext: string;
  readonly secretIv: string;
  readonly secretAuthTag: string;
  readonly keyVersion: string;
}

@Injectable()
export class MfaCryptoService {
  public constructor(private readonly config: AuthConfig) {}

  public encrypt(secret: string, userId: string): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.config.mfaEncryptionKey, iv);

    cipher.setAAD(Buffer.from(userId));
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);

    return {
      secretCiphertext: ciphertext.toString('base64'),
      secretIv: iv.toString('base64'),
      secretAuthTag: cipher.getAuthTag().toString('base64'),
      keyVersion: this.config.mfaKeyVersion
    };
  }

  public decrypt(
    credential: {
      readonly secretCiphertext: string;
      readonly secretIv: string;
      readonly secretAuthTag: string;
      readonly keyVersion: string;
    },
    userId: string
  ): string {
    if (credential.keyVersion !== this.config.mfaKeyVersion) {
      throw new Error('A versão da chave MFA não está disponível.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.config.mfaEncryptionKey,
      Buffer.from(credential.secretIv, 'base64')
    );

    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(Buffer.from(credential.secretAuthTag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(credential.secretCiphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
  }
}
