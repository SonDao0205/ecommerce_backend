import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: ReturnType<typeof createClient>;
  private connecting: Promise<void> | null = null;
  private lastWarningAt = 0;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL');
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.configService.get<string>('REDIS_PORT') ?? 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const database = Number(this.configService.get<string>('REDIS_DB') ?? 0);

    this.client = createClient({
      ...(url
        ? { url }
        : {
            socket: {
              host,
              port,
              connectTimeout: 1_500,
              reconnectStrategy: (retries) =>
                retries > 5 ? new Error('Redis reconnect limit reached') : 500,
            },
            ...(password && { password }),
            database,
          }),
    });

    this.client.on('ready', () => this.logger.log('Redis cache connected'));
    this.client.on('error', (error: Error) =>
      this.warnRateLimited(`Redis unavailable: ${error.message || 'unknown'}`),
    );
  }

  onModuleInit(): void {
    this.connectInBackground();
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client.isOpen) return;
    await this.client.close();
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client.isReady) {
      this.connectInBackground();
      return null;
    }
    try {
      const value = await this.client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logOperationError('GET', key, error);
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.client.isReady) {
      this.connectInBackground();
      return;
    }
    try {
      await this.client.set(key, JSON.stringify(value), {
        EX: Math.max(1, Math.floor(ttlSeconds)),
      });
    } catch (error) {
      this.logOperationError('SET', key, error);
    }
  }

  async setJsonIfAbsent(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.client.isReady) {
      this.connectInBackground();
      return false;
    }
    try {
      const result = await this.client.set(key, JSON.stringify(value), {
        EX: Math.max(1, Math.floor(ttlSeconds)),
        NX: true,
      });
      return result === 'OK';
    } catch (error) {
      this.logOperationError('SET NX', key, error);
      return false;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client.isReady) {
      this.connectInBackground();
      return;
    }
    try {
      await this.client.del(key);
    } catch (error) {
      this.logOperationError('DEL', key, error);
    }
  }

  async increment(key: string): Promise<number> {
    if (!this.client.isReady) {
      this.connectInBackground();
      return 0;
    }
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logOperationError('INCR', key, error);
      return 0;
    }
  }

  async getNumber(key: string): Promise<number> {
    if (!this.client.isReady) {
      this.connectInBackground();
      return 0;
    }
    try {
      const value = await this.client.get(key);
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch (error) {
      this.logOperationError('GET', key, error);
      return 0;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client.isReady) {
      this.connectInBackground();
      return false;
    }
    try {
      return (await this.client.ping()) === 'PONG';
    } catch (error) {
      this.logOperationError('PING', 'redis', error);
      return false;
    }
  }

  async consumeFixedWindow(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ count: number; retryAfterSeconds: number } | null> {
    if (!this.client.isReady) {
      this.connectInBackground();
      return null;
    }
    try {
      const result = (await this.client.eval(
        `local count = redis.call('INCR', KEYS[1])
         if count == 1 then
           redis.call('EXPIRE', KEYS[1], ARGV[1])
         end
         local ttl = redis.call('TTL', KEYS[1])
         return {count, ttl}`,
        {
          keys: [key],
          arguments: [String(Math.max(1, Math.floor(windowSeconds)))],
        },
      )) as [number, number];
      return {
        count: Number(result[0]),
        retryAfterSeconds: Math.max(1, Number(result[1])),
      };
    } catch (error) {
      this.logOperationError('RATE_LIMIT', key, error);
      return null;
    }
  }

  /**
   * Cache-aside with local single-flight and a short Redis lock. Concurrent
   * misses no longer make every API instance execute the same database query.
   */
  async rememberJson<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const task = this.loadOnce(key, ttlSeconds, loader).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, task);
    return task;
  }

  private async loadOnce<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (!this.client.isReady) {
      return loader();
    }

    const lockKey = `lock:${key}`;
    const token = randomUUID();
    try {
      const acquired = await this.client.set(lockKey, token, {
        NX: true,
        PX: 5_000,
      });
      if (acquired === 'OK') {
        try {
          const value = await loader();
          await this.setJson(key, value, ttlSeconds);
          return value;
        } finally {
          await this.client.eval(
            `if redis.call('get', KEYS[1]) == ARGV[1] then
               return redis.call('del', KEYS[1])
             end
             return 0`,
            { keys: [lockKey], arguments: [token] },
          );
        }
      }

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
        const cached = await this.getJson<T>(key);
        if (cached !== null) return cached;
      }
    } catch (error) {
      this.logOperationError('REMEMBER', key, error);
    }

    // Lock owner may have failed or be slow. Availability wins over waiting.
    const value = await loader();
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  private connectInBackground(): void {
    if (this.client.isOpen || this.connecting) return;
    this.connecting = this.client
      .connect()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.connecting = null;
      });
  }

  private logOperationError(
    operation: string,
    key: string,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    this.warnRateLimited(`Redis ${operation} ${key} failed: ${message}`);
  }

  private warnRateLimited(message: string): void {
    const now = Date.now();
    if (now - this.lastWarningAt < 30_000) return;
    this.lastWarningAt = now;
    this.logger.warn(message);
  }
}
