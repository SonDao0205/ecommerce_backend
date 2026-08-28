import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { RedisCacheService } from '../cache/redis-cache.service';
import { RATE_LIMIT_METADATA, RateLimitOptions } from './rate-limit.decorator';

interface LocalCounter {
  count: number;
  expiresAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly localFallback = new Map<string, LocalCounter>();

  constructor(
    private readonly reflector: Reflector,
    private readonly cache: RedisCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const tracker = this.tracker(request, options.scope ?? 'ip');
    const route = `${request.method}:${request.baseUrl}${request.route?.path ?? request.path}`;
    const digest = createHash('sha256')
      .update(`${options.keyPrefix ?? route}:${tracker}`)
      .digest('hex');
    const key = `rate-limit:${digest}`;
    const distributed = await this.cache.consumeFixedWindow(
      key,
      options.limit,
      options.windowSeconds,
    );
    const result =
      distributed ??
      this.consumeLocal(key, options.limit, options.windowSeconds);
    const remaining = Math.max(0, options.limit - result.count);

    response.setHeader('X-RateLimit-Limit', String(options.limit));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    if (result.count <= options.limit) return true;

    response.setHeader('Retry-After', String(result.retryAfterSeconds));
    throw new HttpException(
      {
        status: false,
        message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau!',
        data: null,
        code: 429,
      },
      429,
    );
  }

  private tracker(request: Request, scope: 'ip' | 'identity'): string {
    if (scope === 'identity') {
      const authorization = request.headers.authorization;
      if (authorization) {
        return createHash('sha256').update(authorization).digest('hex');
      }
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private consumeLocal(
    key: string,
    _limit: number,
    windowSeconds: number,
  ): { count: number; retryAfterSeconds: number } {
    const now = Date.now();
    if (this.localFallback.size >= 10_000) {
      for (const [entryKey, entry] of this.localFallback) {
        if (entry.expiresAt <= now) this.localFallback.delete(entryKey);
      }
      if (this.localFallback.size >= 10_000) {
        const oldestKey = this.localFallback.keys().next().value as
          string | undefined;
        if (oldestKey) this.localFallback.delete(oldestKey);
      }
    }
    const current = this.localFallback.get(key);
    if (!current || current.expiresAt <= now) {
      this.localFallback.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return { count: 1, retryAfterSeconds: windowSeconds };
    }
    current.count += 1;
    return {
      count: current.count,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.expiresAt - now) / 1000),
      ),
    };
  }
}
