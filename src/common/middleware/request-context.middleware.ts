import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const received = request.header('x-request-id');
    const requestId =
      received && /^[A-Za-z0-9._-]{1,100}$/.test(received)
        ? received
        : randomUUID();
    response.setHeader('X-Request-Id', requestId);
    const startedAt = process.hrtime.bigint();

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      this.logger.log(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
        }),
      );
    });
    next();
  }
}
