import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CartService, CartView } from './cart.service';
import { CartItemDto, UpdateCartItemDto } from './dto/cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseData<CartView>> {
    return this.response(
      'Lấy giỏ hàng thành công!',
      await this.cartService.getCart(req.user.id!),
    );
  }

  @Post('items')
  async addItem(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CartItemDto,
  ): Promise<ApiResponseData<CartView>> {
    return this.response(
      'Đã thêm sản phẩm vào giỏ hàng!',
      await this.cartService.addItem(req.user.id!, dto),
      201,
    );
  }

  @Post('merge')
  async merge(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MergeCartDto,
  ): Promise<ApiResponseData<CartView>> {
    return this.response(
      'Đồng bộ giỏ hàng thành công!',
      await this.cartService.mergeCart(req.user.id!, dto),
    );
  }

  @Patch('items/:itemId')
  async updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<ApiResponseData<CartView>> {
    return this.response(
      'Cập nhật giỏ hàng thành công!',
      await this.cartService.updateItem(req.user.id!, itemId, dto),
    );
  }

  @Delete('items/:itemId')
  async removeItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<ApiResponseData<CartView>> {
    return this.response(
      'Đã xóa sản phẩm khỏi giỏ hàng!',
      await this.cartService.removeItem(req.user.id!, itemId),
    );
  }

  @Delete()
  async clearCart(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseData<CartView>> {
    return this.response(
      'Đã xóa toàn bộ giỏ hàng!',
      await this.cartService.clearCart(req.user.id!),
    );
  }

  private response<T>(
    message: string,
    data: T,
    code = 200,
  ): ApiResponseData<T> {
    return { status: true, message, data, code };
  }
}
