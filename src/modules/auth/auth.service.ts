// src/modules/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRoleEnum } from '@entities';
import { RegisterDto } from './dto/register.dto';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from './auth.repository';
import { JwtPayload } from './auth.types';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { authSessionCacheKey } from './auth-cache.constants';
import { DASHBOARD_CACHE_VERSION_KEY } from '../dashboard/dashboard-cache.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cache: RedisCacheService,
  ) {}

  // Helper: Sinh cặp Access Token và Refresh Token
  private async generateTokens(
    userId: string,
    email: string | null | undefined,
    roles: string[],
  ) {
    const payload = { sub: userId, ...(email && { email }), roles };
    const accessExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // Helper: Băm và lưu Refresh Token vào Database
  private async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ) {
    let hashedRefreshToken: string | null = null;
    if (refreshToken) {
      hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    }
    await this.authRepository.updateRefreshToken(userId, hashedRefreshToken);
  }

  // 1. ĐĂNG KÝ
  async register(registerDto: RegisterDto) {
    const { password, phone, fullName } = registerDto;
    const email = registerDto.email?.trim().toLowerCase();

    if (!password || !phone || !fullName) {
      throw new BadRequestException('Bạn cần nhập đầy đủ thông tin!');
    }

    if (email) {
      const existEmail = await this.existByEmail(email);
      if (existEmail) throw new ConflictException('Email đã tồn tại!');
    }

    const existPhone = await this.existByPhone(phone);
    if (existPhone) throw new ConflictException('Số điện thoại đã tồn tại!');

    const defaultRole = await this.authRepository.findRoleByName(
      UserRoleEnum.CUSTOMER,
    );
    if (!defaultRole) {
      throw new InternalServerErrorException('Không tìm thấy Role mặc định!');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const savedUser = await this.authRepository.createUserWithRole(
        {
          email,
          fullName,
          phone,
          password: hashedPassword,
        },
        defaultRole,
      );

      delete savedUser.password;
      await this.cache.increment(DASHBOARD_CACHE_VERSION_KEY);
      return {
        ...savedUser,
        roles: [defaultRole.name],
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email hoặc số điện thoại đã tồn tại!');
      }
      throw new InternalServerErrorException('Lỗi khi đăng ký tài khoản!');
    }
  }

  // 2. ĐĂNG NHẬP
  async login(loginDto: LoginDto) {
    const { password } = loginDto;
    const identifier = loginDto.identifier ?? loginDto.email;
    if (!identifier) {
      throw new BadRequestException('Vui lòng nhập email hoặc số điện thoại!');
    }

    const user =
      await this.authRepository.findByIdentifierWithPassword(identifier);

    if (!user || !user.password) {
      throw new UnauthorizedException(
        'Email, số điện thoại hoặc mật khẩu không chính xác!',
      );
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa!');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException(
        'Email, số điện thoại hoặc mật khẩu không chính xác!',
      );
    }

    // Lấy roles
    const roles = await this.authRepository.findRoleNamesByUserId(user.id!);

    // Sinh cặp token
    const tokens = await this.generateTokens(user.id!, user.email, roles);

    // Lưu hashed Refresh Token vào Database
    await this.updateRefreshToken(user.id!, tokens.refreshToken);
    await this.markSessionActive(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        roles,
      },
    };
  }

  // 3. REFRESH TOKEN (CẤP LẠI TOKEN MỚI)
  async refreshToken(refreshToken: string) {
    try {
      // Xác minh chữ ký của Refresh Token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );

      // Lấy User kèm hashed refresh token trong DB
      const user = await this.authRepository.findByIdWithRefreshToken(
        payload.sub,
      );

      if (!user || !user.refreshToken || !user.isActive) {
        throw new ForbiddenException('Quyền truy cập bị từ chối!');
      }

      // So khớp Refresh Token gửi lên với chuỗi băm trong DB
      const isTokenMatch = await bcrypt.compare(
        refreshToken,
        user.refreshToken,
      );
      if (!isTokenMatch) {
        throw new ForbiddenException('Quyền truy cập bị từ chối!');
      }

      // Lấy lại danh sách roles
      const roles = await this.authRepository.findRoleNamesByUserId(user.id!);

      // Sinh cặp tokens mới (Token Rotation)
      const tokens = await this.generateTokens(user.id!, user.email, roles);
      await this.updateRefreshToken(user.id!, tokens.refreshToken);
      await this.markSessionActive(user);

      return tokens;
    } catch {
      throw new ForbiddenException(
        'Refresh Token không hợp lệ hoặc đã hết hạn!',
      );
    }
  }

  // 4. ĐĂNG XUẤT (VÔ HIỆU HÓA TOKEN)
  async logout(userId: string) {
    // Xóa Refresh Token trong Database (set về null)
    await this.updateRefreshToken(userId, null);
    const revokedTtl = Number(
      this.configService.get<string>(
        'AUTH_SESSION_REVOKED_TTL_SECONDS',
        '86400',
      ),
    );
    await this.cache.setJson(
      authSessionCacheKey(userId),
      { active: false },
      revokedTtl,
    );
    return { message: 'Đăng xuất thành công!' };
  }

  async existByEmail(email: string): Promise<boolean> {
    return this.authRepository.emailExists(email);
  }

  async existByPhone(phone: string): Promise<boolean> {
    return this.authRepository.phoneExists(phone);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }

  private async markSessionActive(user: {
    id?: string;
    email?: string | null;
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
    isActive?: boolean;
  }): Promise<void> {
    if (!user.id) return;
    const ttl = Number(
      this.configService.get<string>('AUTH_SESSION_CACHE_TTL_SECONDS', '60'),
    );
    await this.cache.setJson(
      authSessionCacheKey(user.id),
      {
        active: true,
        user: {
          id: user.id,
          email: user.email ?? null,
          fullName: user.fullName,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          isActive: user.isActive !== false,
        },
      },
      ttl,
    );
  }
}
