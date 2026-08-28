import { DataSource } from 'typeorm';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('is ready only when PostgreSQL and Redis are available', async () => {
    const database = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const cache = { ping: jest.fn().mockResolvedValue(true) };
    const service = new HealthService(
      database as unknown as DataSource,
      cache as unknown as RedisCacheService,
    );

    await expect(service.readiness()).resolves.toMatchObject({
      status: 'ok',
      checks: { postgres: 'up', redis: 'up' },
    });
  });

  it('reports dependency failure without throwing', async () => {
    const database = { query: jest.fn().mockRejectedValue(new Error('down')) };
    const cache = { ping: jest.fn().mockResolvedValue(true) };
    const service = new HealthService(
      database as unknown as DataSource,
      cache as unknown as RedisCacheService,
    );

    await expect(service.readiness()).resolves.toMatchObject({
      status: 'error',
      checks: { postgres: 'down', redis: 'up' },
    });
  });
});
