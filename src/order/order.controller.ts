import {
  Body,
  Controller,
  HttpStatus,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiResponseData } from '../dto/response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';
import { CreateOrderDto } from './dto/create_order.dto.js';
import { OrderService } from './order.service.js';

@Controller('api/v1/order')
@UseGuards(AuthGuard, EmailVerifiedGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /** Tạo order; client cần gửi lại cùng Idempotency-Key khi retry request. */
  @Post()
  async createOrder(
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateOrderDto,
  ) {
    const userId = (request as any).user?.id as string;
    const order = await this.orderService.createOrder(
      userId,
      dto,
      idempotencyKey ?? '',
    );
    return new ApiResponseData(
      true,
      'Tạo order thành công.',
      order,
      HttpStatus.CREATED,
    );
  }
}
