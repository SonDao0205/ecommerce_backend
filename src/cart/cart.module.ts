import { Module } from '@nestjs/common';
import { CartService } from './cart.service.js';
import { CartController } from './cart.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity.js';
import { CartItem } from './entities/cart-item.entity.js';
import { ProductVariant } from '../product/entities/product_variant.entity.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([Cart, CartItem, ProductVariant]),
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
