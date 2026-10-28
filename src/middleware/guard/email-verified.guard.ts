import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

type AuthenticatedRequest = Request & {
  user?: {
    email_verified?: number | boolean;
  };
};

/** Chặn thao tác được bảo vệ nếu người dùng chưa xác thực email. */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Không xác định được người dùng!');
    }

    if (Number(user.email_verified) !== 1) {
      throw new ForbiddenException(
        'Vui lòng xác thực email trước khi thực hiện thao tác này!',
      );
    }

    return true;
  }
}
