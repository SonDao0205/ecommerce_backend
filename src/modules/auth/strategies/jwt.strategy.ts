// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../auth.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; email?: string; roles: string[] }) {
    const user = await this.authRepository.findByIdWithRefreshToken(
      payload.sub,
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Người dùng không tồn tại hoặc bị khóa!');
    }

    // 🔒 NẾU USER ĐÃ LOGOUT (refreshToken = null trong DB) -> VÔ HIỆU HÓA ACCESS TOKEN NGAY LẬP TỨC
    if (!user.refreshToken) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại!',
      );
    }

    return {
      ...user,
      roles: payload.roles || [],
    };
  }
}
