// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../auth.repository';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import {
  authSessionCacheKey,
  CachedAuthSession,
} from '../auth-cache.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly cache: RedisCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; email?: string; roles: string[] }) {
    const key = authSessionCacheKey(payload.sub);
    const cached = await this.cache.getJson<CachedAuthSession>(key);
    if (cached?.active && cached.user) {
      return { ...cached.user, roles: payload.roles || [] };
    }
    if (cached && !cached.active) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại!',
      );
    }

    const user = await this.authRepository.findByIdWithRefreshToken(
      payload.sub,
    );

    if (!user || !user.isActive) {
      await this.cache.setJson(key, { active: false }, this.sessionTtl());
      throw new UnauthorizedException('Người dùng không tồn tại hoặc bị khóa!');
    }

    // 🔒 NẾU USER ĐÃ LOGOUT (refreshToken = null trong DB) -> VÔ HIỆU HÓA ACCESS TOKEN NGAY LẬP TỨC
    if (!user.refreshToken) {
      await this.cache.setJson(key, { active: false }, this.sessionTtl());
      throw new UnauthorizedException(
        'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại!',
      );
    }

    const session: CachedAuthSession = {
      active: true,
      user: {
        id: user.id!,
        email: user.email ?? null,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
      },
    };
    // SET NX prevents an in-flight validation from overwriting the logout
    // tombstone written after the database read.
    await this.cache.setJsonIfAbsent(key, session, this.sessionTtl());

    return {
      ...session.user,
      roles: payload.roles || [],
    };
  }

  private sessionTtl(): number {
    return Number(
      this.configService.get<string>('AUTH_SESSION_CACHE_TTL_SECONDS', '60'),
    );
  }
}
