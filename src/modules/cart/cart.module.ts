import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart, CartItem, Inventory, Product, ProductVariant } from '@entities';
import { CartController } from './cart.controller';
import { CartRepository } from './cart.repository';
import { CartService } from './cart.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cart,
      CartItem,
      Product,
      ProductVariant,
      Inventory,
    ]),
  ],
  controllers: [CartController],
  providers: [CartService, CartRepository],
})
export class CartModule {}
