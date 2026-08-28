import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cart,
  CartItem,
  Inventory,
  InventoryTransaction,
  Order,
  OrderItem,
  Product,
  ProductVariant,
} from '@entities';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      ProductVariant,
      Inventory,
      InventoryTransaction,
      Cart,
      CartItem,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
