import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

/**
 * ResetPasswordGuard — Xác thực token đổi mật khẩu (sau khi OTP hợp lệ).
 *
 * Token này khác access token: chỉ dùng cho route reset password
 * và payload phải có purpose = reset_password.
 */
@Injectable()
export class ResetPasswordGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        'Token đổi mật khẩu không hợp lệ hoặc đã hết hạn!',
      );
    }

    const secret = process.env.RESET_PASSWORD_TOKEN_SECRET;
    if (!secret) {
      throw new UnauthorizedException(
        'Server chưa cấu hình RESET_PASSWORD_TOKEN_SECRET!',
      );
    }

    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;

      if (payload.purpose !== 'reset_password' || !payload.id) {
        throw new UnauthorizedException(
          'Token đổi mật khẩu không hợp lệ hoặc đã hết hạn!',
        );
      }

      (request as any).user = payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(
        'Token đổi mật khẩu không hợp lệ hoặc đã hết hạn!',
      );
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return undefined;

    const [scheme, token] = authHeader.split(' ');
    return scheme === 'Bearer' ? token : undefined;
  }
}
