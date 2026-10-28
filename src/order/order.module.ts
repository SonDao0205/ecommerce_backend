import { Module } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';

@Module({
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
