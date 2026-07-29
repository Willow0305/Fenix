import { createHmac } from 'node:crypto';

import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

import { ApplicationConfig } from '../config/application.config';
import type { RateLimitPolicyName } from './rate-limit.decorator';
import { RateLimitConfig } from './rate-limit.config';

const FIXED_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

interface MemoryCounter {
  count: number;
  expiresAt: number;
}

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly memory = new Map<string, MemoryCounter>();
  private readonly keyPepper: string;
  private redis?: RedisClientType;

  public constructor(
    private readonly config: RateLimitConfig,
    private readonly applicationConfig: ApplicationConfig
  ) {
    this.keyPepper = process.env['AUTH_CONTEXT_HASH_PEPPER'] ?? 'fenix-local-rate-limit-key-pepper';
  }

  public async onModuleInit(): Promise<void> {
    if (!this.config.redisUrl) {
      if (this.applicationConfig.isProductionLike) {
        throw new Error('Redis é obrigatório para rate limit em staging e produção.');
      }

      return;
    }

    const client = createClient({
      url: this.config.redisUrl,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy: false
      }
    });

    client.on('error', () => {
      // A indisponibilidade é tratada como falha fechada no consumo.
    });
    await client.connect();
    this.redis = client as RedisClientType;
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.redis?.isOpen) {
      await this.redis.close();
    }
  }

  public async consume(policyName: RateLimitPolicyName, subject: string): Promise<RateLimitResult> {
    const policy = this.config.policy(policyName);
    const key = this.createKey(policyName, subject);

    if (!this.redis) {
      return this.consumeMemory(key, policy.limit, policy.windowSeconds);
    }

    try {
      const raw = await this.redis.eval(FIXED_WINDOW_SCRIPT, {
        arguments: [String(policy.windowSeconds)],
        keys: [key]
      });

      if (!Array.isArray(raw) || typeof raw[0] !== 'number' || typeof raw[1] !== 'number') {
        throw new Error('Resposta inválida do Redis.');
      }

      return {
        allowed: raw[0] <= policy.limit,
        remaining: Math.max(0, policy.limit - raw[0]),
        retryAfterSeconds: Math.max(1, raw[1])
      };
    } catch {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: policy.windowSeconds
      };
    }
  }

  private consumeMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const current = this.memory.get(key);
    const counter =
      current && current.expiresAt > now
        ? current
        : {
            count: 0,
            expiresAt: now + windowSeconds * 1000
          };

    counter.count += 1;
    this.memory.set(key, counter);

    if (this.memory.size > 10_000) {
      for (const [candidateKey, candidate] of this.memory) {
        if (candidate.expiresAt <= now) {
          this.memory.delete(candidateKey);
        }
      }
    }

    return {
      allowed: counter.count <= limit,
      remaining: Math.max(0, limit - counter.count),
      retryAfterSeconds: Math.max(1, Math.ceil((counter.expiresAt - now) / 1000))
    };
  }

  private createKey(policyName: RateLimitPolicyName, subject: string): string {
    const digest = createHmac('sha256', this.keyPepper)
      .update(subject.trim().toLocaleLowerCase('en-US'))
      .digest('hex');

    return `fenix:rate:${policyName}:${digest}`;
  }
}
