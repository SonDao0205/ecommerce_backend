import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { Request } from 'express';

/**
 * AuthGuard — Xác thực JWT Token
 *
 * Guard này chịu trách nhiệm kiểm tra xem request có mang
 * một Access Token hợp lệ hay không trước khi cho phép
 * truy cập vào các route được bảo vệ.
 *
 * Cách dùng:
 *   @UseGuards(AuthGuard)
 *   @Get('profile')
 *   getProfile() { ... }
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ── Giai đoạn 1: Lấy HTTP request từ execution context ──────────────────
    // NestJS hỗ trợ nhiều loại context (HTTP, WebSocket, gRPC…).
    // switchToHttp() giúp ta lấy đúng đối tượng HTTP request.
    const request = context.switchToHttp().getRequest<Request>();
    console.log('request : ', request);

    // ── Giai đoạn 2: Trích xuất token từ header Authorization ───────────────
    // Client cần gửi header dạng: Authorization: Bearer <token>
    const token = this.extractTokenFromHeader(request);

    // Nếu không có token → từ chối truy cập ngay lập tức
    if (!token) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc không hợp lệ!',
      );
    }

    // ── Giai đoạn 3: Xác minh (verify) token ────────────────────────────────
    // jwt.verify sẽ kiểm tra:
    //   - Chữ ký có khớp với SECRET không?
    //   - Token có còn hạn sử dụng không?
    // Nếu sai hoặc hết hạn → ném lỗi, guard trả về false.
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      throw new UnauthorizedException(
        'Server chưa cấu hình ACCESS_TOKEN_SECRET!',
      );
    }

    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;

      // ── Giai đoạn 4: Đính kèm payload vào request ─────────────────────────
      // Lưu thông tin user đã decode vào request.user để các handler
      // ở phía sau (controller, RolesGuard…) có thể tái sử dụng,
      // tránh phải decode lại token nhiều lần.
      (request as any).user = payload;
    } catch {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc không hợp lệ!',
      );
    }

    // ── Giai đoạn 5: Cho phép tiếp tục ─────────────────────────────────────
    // Trả về true → NestJS chuyển request tới handler tiếp theo.
    return true;
  }

  /**
   * Tách Bearer token ra khỏi header Authorization.
   * Trả về chuỗi token thuần, hoặc undefined nếu không hợp lệ.
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return undefined;

    // Header phải có dạng "Bearer <token>"
    const [scheme, token] = authHeader.split(' ');
    return scheme === 'Bearer' ? token : undefined;
  }
}
