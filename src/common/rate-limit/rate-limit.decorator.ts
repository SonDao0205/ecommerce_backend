import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA = 'ecommerce:rate-limit';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  scope?: 'ip' | 'identity';
  keyPrefix?: string;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA, options);
