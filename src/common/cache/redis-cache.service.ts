import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: ReturnType<typeof createClient>;
  private connecting: Promise<void> | null = null;
  private lastWarningAt = 0;

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
