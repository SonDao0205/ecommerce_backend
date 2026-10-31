import { Module } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
import { VoucherModule } from '../voucher/voucher.module.js';

@Module({
  imports: [VoucherModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
