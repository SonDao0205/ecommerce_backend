import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisCacheService } from '@common/cache/redis-cache.service';

export interface ReadinessResult {
  status: 'ok' | 'error';
  checks: {
    postgres: 'up' | 'down';
    redis: 'up' | 'down';
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: RedisCacheService,
  ) {}

  async readiness(): Promise<ReadinessResult> {
    const [postgres, redis] = await Promise.all([
      this.withTimeout(
        this.dataSource.query('SELECT 1').then(() => true),
        1_500,
      ),
      this.withTimeout(this.cache.ping(), 1_500),
    ]);
    return {
      status: postgres && redis ? 'ok' : 'error',
      checks: {
        postgres: postgres ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async withTimeout(
    operation: Promise<boolean>,
    timeoutMs: number,
  ): Promise<boolean> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation.catch(() => false),
        new Promise<boolean>((resolve) => {
          timeout = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
