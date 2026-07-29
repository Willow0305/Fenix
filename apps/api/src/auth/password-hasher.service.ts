import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

import { AuthConfig } from './auth.config';

@Injectable()
export class PasswordHasherService {
  public constructor(private readonly config: AuthConfig) {}

  public hash(password: string): Promise<string> {
    return hash(password, this.config.bcryptCost);
  }

  public verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}
