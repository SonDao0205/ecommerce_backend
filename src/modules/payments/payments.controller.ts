import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { UserRoleEnum } from '@entities';
import { Roles } from '@common/decorators/roles.decorator';
import { RateLimit } from '@common/rate-limit/rate-limit.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('sepay/ipn')
  @HttpCode(200)
  async sepayIpn(
    @Headers('x-secret-key') secret: string | undefined,
    @Body() body: unknown,
  ) {
    await this.service.handleSepayIpn(secret, body);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.CUSTOMER)
  @Get('my/:id')
  async getMyPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      status: true,
      message: 'Lấy trạng thái thanh toán thành công!',
      data: await this.service.getMyPayment(req.user.id!, id),
      code: 200,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.CUSTOMER)
  @Post('my/:id/cancel')
  @RateLimit({
    limit: 10,
    windowSeconds: 60,
    scope: 'identity',
    keyPrefix: 'payments:cancel',
  })
  async cancelMyPayment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      status: true,
      message: 'Đã hủy thanh toán!',
      data: await this.service.cancelMyPayment(req.user.id!, id),
      code: 200,
    };
  }
}
