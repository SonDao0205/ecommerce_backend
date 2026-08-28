// src/modules/auth/guards/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { UserRoleEnum } from '@entities';
import { AuthenticatedRequest } from '../auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Đọc danh sách roles yêu cầu từ Decorator @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<UserRoleEnum[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu API không gắn @Roles -> Ai đã đăng nhập cũng gọi được
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 2. Lấy thông tin user từ request (do JwtStrategy gắn vào req.user)
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user || !user.roles) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập tài nguyên này!',
      );
    }

    // 3. Kiểm tra user có sở hữu ít nhất 1 trong các role được yêu cầu không
    const hasRole = user.roles.some((role: UserRoleEnum) =>
      requiredRoles.includes(role),
    );

    if (!hasRole) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập tài nguyên này!',
      );
    }

    return true;
  }
}
