import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ShippingService } from './shipping.service.js';
import { CreateShippingMethodDto } from './dto/create_shipping_method.dto.js';
import { ApiResponseData } from '../dto/response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { UserRole } from '../user/entities/enums/user.enum.js';

@Controller('api/v1/shipping/methods')
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /** Tạo một phương thức vận chuyển mới. */
  @Post()
  async createMethod(@Body() dto: CreateShippingMethodDto) {
    const method = await this.shippingService.createMethod(dto);
    return new ApiResponseData(
      true,
      'Tạo phương thức vận chuyển thành công.',
      method,
      HttpStatus.CREATED,
    );
  }

  /** Kích hoạt phương thức vận chuyển theo ID. */
  @Patch(':id/active')
  async activeMethod(@Param('id') id: string) {
    await this.shippingService.activeMethod(id);
    return new ApiResponseData(
      true,
      'Kích hoạt phương thức vận chuyển thành công.',
      null,
      HttpStatus.OK,
    );
  }

  /** Ngừng kích hoạt phương thức vận chuyển theo ID. */
  @Patch(':id/unactive')
  async unactiveMethod(@Param('id') id: string) {
    await this.shippingService.unactiveMethod(id);
    return new ApiResponseData(
      true,
      'Ngừng kích hoạt phương thức vận chuyển thành công.',
      null,
      HttpStatus.OK,
    );
  }
}
