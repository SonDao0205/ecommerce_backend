import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisCacheService } from '../cache/redis-cache.service';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  const options = { limit: 2, windowSeconds: 60 };
  let cache: { consumeFixedWindow: jest.Mock };
  let response: { setHeader: jest.Mock };
  let context: ExecutionContext;

  beforeEach(() => {
    cache = { consumeFixedWindow: jest.fn() };
    response = { setHeader: jest.fn() };
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          baseUrl: '/api/v1/auth',
          path: '/login',
          route: { path: '/login' },
          headers: {},
          ip: '127.0.0.1',
          socket: {},
        }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  });

  it('allows requests below the distributed limit and sets headers', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(options),
    };
    cache.consumeFixedWindow.mockResolvedValue({
      count: 1,
      retryAfterSeconds: 59,
    });
    const guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      cache as unknown as RedisCacheService,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Remaining',
      '1',
    );
  });

  it('returns 429 after the shared limit is exceeded', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(options),
    };
    cache.consumeFixedWindow.mockResolvedValue({
      count: 3,
      retryAfterSeconds: 42,
    });
    const guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      cache as unknown as RedisCacheService,
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('falls back to a bounded in-memory counter when Redis is unavailable', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        limit: 1,
        windowSeconds: 60,
      }),
    };
    cache.consumeFixedWindow.mockResolvedValue(null);
    const guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      cache as unknown as RedisCacheService,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
