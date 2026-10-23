import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * ROLES_KEY — key dùng để lưu metadata role khi dùng decorator @Roles()
 *
 * Cách khai báo decorator:
 *   export const Roles = (...roles: string[]) =>
 *     SetMetadata(ROLES_KEY, roles);
 *
 * Cách dùng trên route:
 *   @Roles('admin', 'shop')
 *   @UseGuards(AuthGuard, RolesGuard)
 *   @Get('dashboard')
 *   getDashboard() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const ROLES_KEY = 'roles';

/**
 * RolesGuard — Phân quyền theo Role
 *
 * Guard này chạy SAU AuthGuard. Lúc này request.user đã được
 * AuthGuard điền đầy đủ thông tin (bao gồm trường role).
 *
 * RolesGuard kiểm tra xem role của user hiện tại có nằm trong
 * danh sách role được phép truy cập route đó không.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  // Reflector giúp đọc metadata được gắn bởi decorator @Roles()
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ── Giai đoạn 1: Đọc danh sách role được phép từ metadata ──────────────
    // getAllAndOverride ưu tiên metadata ở cấp Handler (method) trước,
    // nếu không có thì lấy metadata ở cấp Class (controller).
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [
        context.getHandler(), // metadata của method handler
        context.getClass(), // metadata của class controller
      ],
    );

    // Nếu route không yêu cầu role cụ thể nào → cho phép tất cả truy cập
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // ── Giai đoạn 2: Lấy thông tin user từ request ──────────────────────────
    // request.user đã được AuthGuard gán ở bước trước,
    // chứa payload JWT (bao gồm id, name, email, role…).
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user as { role?: string };

    // Nếu không có user (AuthGuard bị bỏ qua hoặc lỗi logic) → từ chối
    if (!user || !user.role) {
      throw new ForbiddenException('Không xác định được role của người dùng!');
    }

    // ── Giai đoạn 3: Kiểm tra role của user có hợp lệ không ─────────────────
    // So sánh role của user với danh sách role được phép.
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(`Bạn không có quyền truy cập!`);
    }

    // ── Giai đoạn 4: Cho phép tiếp tục ─────────────────────────────────────
    // Role hợp lệ → trả về true, request được chuyển tới handler.
    return true;
  }
}
