import { Module } from '@nestjs/common';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
import { VoucherModule } from '../voucher/voucher.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity.js';
import { UserModule } from '../user/user.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { ShippingModule } from '../shipping/shipping.module.js';
import { ProductModule } from '../product/product.module.js';
import { ShopModule } from '../shop/shop.module.js';
import { OrderItemService } from './order-item.service.js';

@Module({
  imports: [
    UserModule,
    PaymentModule,
    ShippingModule,
    ProductModule,
    ShopModule,
    VoucherModule,
    TypeOrmModule.forFeature([Order]),
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderItemService],
})
export class OrderModule {}
