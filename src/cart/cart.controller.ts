import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CartService } from './cart.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import { ApiResponseData } from '../dto/response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';

@Controller('api/v1/cart')
@UseGuards(AuthGuard, EmailVerifiedGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /** Lấy giỏ hàng hiện tại của tài khoản đã đăng nhập. */
  @Get()
  async getCart(@Req() request: Request) {
    const userId = (request as any).user?.id as string;
    const cart = await this.cartService.getCart(userId);
    return new ApiResponseData(
      true,
      'Lấy giỏ hàng thành công.',
      cart,
      HttpStatus.OK,
    );
  }

  /** Thêm variant vào giỏ hoặc cộng quantity nếu variant đã tồn tại. */
  @Post('items')
  async addItem(@Req() request: Request, @Body() dto: AddCartItemDto) {
    const userId = (request as any).user?.id as string;
    const cart = await this.cartService.addItem(
      userId,
      dto.variant_id,
      dto.quantity,
    );
    return new ApiResponseData(
      true,
      'Đã thêm sản phẩm vào giỏ hàng.',
      cart,
      HttpStatus.OK,
    );
  }

  /** Đặt quantity mới cho variant đã nằm trong giỏ hàng. */
  @Patch('items/:variantId')
  async updateItemQuantity(
    @Req() request: Request,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const userId = (request as any).user?.id as string;
    const cart = await this.cartService.updateItemQuantity(
      userId,
      variantId,
      dto.quantity,
    );
    return new ApiResponseData(
      true,
      'Đã cập nhật số lượng sản phẩm trong giỏ.',
      cart,
      HttpStatus.OK,
    );
  }

  /** Xóa toàn bộ quantity của một variant khỏi giỏ. */
  @Delete('items/:variantId')
  async removeItem(
    @Req() request: Request,
    @Param('variantId') variantId: string,
  ) {
    const userId = (request as any).user?.id as string;
    const cart = await this.cartService.removeItem(userId, variantId);
    return new ApiResponseData(
      true,
      'Đã xóa sản phẩm khỏi giỏ hàng.',
      cart,
      HttpStatus.OK,
    );
  }

  /** Xóa tất cả sản phẩm khỏi giỏ hàng của tài khoản hiện tại. */
  @Delete()
  async clearCart(@Req() request: Request) {
    const userId = (request as any).user?.id as string;
    const cart = await this.cartService.clearCart(userId);
    return new ApiResponseData(
      true,
      'Đã xóa toàn bộ giỏ hàng.',
      cart,
      HttpStatus.OK,
    );
  }
}
