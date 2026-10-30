import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service.js';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto.js';
import { ApiResponseData } from '../dto/response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { UserRole } from '../user/entities/enums/user.enum.js';

@Controller('api/v1/payment/methods')
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /** Tạo một phương thức thanh toán mới. */
  @Post()
  async createMethod(@Body() dto: CreatePaymentMethodDto) {
    const method = await this.paymentService.createMethod(dto);
    return new ApiResponseData(
      true,
      'Tạo phương thức thanh toán thành công.',
      method,
      HttpStatus.CREATED,
    );
  }

  /** Kích hoạt phương thức thanh toán theo ID. */
  @Patch(':id/active')
  async activeMethod(@Param('id') id: string) {
    await this.paymentService.activeMethod(id);
    return new ApiResponseData(
      true,
      'Kích hoạt phương thức thanh toán thành công.',
      null,
      HttpStatus.OK,
    );
  }

  /** Ngừng kích hoạt phương thức thanh toán theo ID. */
  @Patch(':id/unactive')
  async unactiveMethod(@Param('id') id: string) {
    await this.paymentService.unactiveMethod(id);
    return new ApiResponseData(
      true,
      'Ngừng kích hoạt phương thức thanh toán thành công.',
      null,
      HttpStatus.OK,
    );
  }
}
