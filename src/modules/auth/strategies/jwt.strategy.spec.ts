import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from '../auth.repository';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy session cache', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'JWT_SECRET' ? 'test-secret' : fallback,
    ),
  } as unknown as ConfigService;
  let repository: { findByIdWithRefreshToken: jest.Mock };
  let cache: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    setJsonIfAbsent: jest.Mock;
  };
  let strategy: JwtStrategy;

  beforeEach(() => {
    repository = { findByIdWithRefreshToken: jest.fn() };
    cache = {
      getJson: jest.fn(),
      setJson: jest.fn().mockResolvedValue(undefined),
      setJsonIfAbsent: jest.fn().mockResolvedValue(true),
    };
    strategy = new JwtStrategy(
      config,
      repository as unknown as AuthRepository,
      cache as unknown as RedisCacheService,
    );
  });

  it('skips PostgreSQL when an active session is cached', async () => {
    cache.getJson.mockResolvedValue({
      active: true,
      user: { id: 'user-1', email: 'admin@example.com', isActive: true },
    });
    await expect(
      strategy.validate({ sub: 'user-1', roles: ['ADMIN'] }),
    ).resolves.toMatchObject({ id: 'user-1', roles: ['ADMIN'] });
    expect(repository.findByIdWithRefreshToken).not.toHaveBeenCalled();
  });

  it('loads PostgreSQL once and warms Redis on cache miss', async () => {
    cache.getJson.mockResolvedValue(null);
    repository.findByIdWithRefreshToken.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      isActive: true,
      refreshToken: 'hash',
    });
    await strategy.validate({ sub: 'user-1', roles: ['ADMIN'] });
    expect(repository.findByIdWithRefreshToken).toHaveBeenCalledWith('user-1');
    expect(cache.setJsonIfAbsent).toHaveBeenCalledWith(
      'auth:session:user-1',
      expect.objectContaining({ active: true }),
      60,
    );
  });

  it('rejects a logout tombstone without querying PostgreSQL', async () => {
    cache.getJson.mockResolvedValue({ active: false });
    await expect(
      strategy.validate({ sub: 'user-1', roles: [] }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.findByIdWithRefreshToken).not.toHaveBeenCalled();
  });
});
