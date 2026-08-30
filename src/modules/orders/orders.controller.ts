import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { UserRoleEnum } from '@entities';
import { Roles } from '@common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BuyNowOrderDto, CreateOrderFromCartDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderSummaryView, OrderView } from './orders.repository';
import { OrdersService } from './orders.service';
import { RateLimit } from '@common/rate-limit/rate-limit.decorator';
import {
  CancelMyOrderDto,
  RequestOrderReturnDto,
  ReviewOrderReturnDto,
} from './dto/order-action.dto';
import { VoucherPreviewDto } from './dto/voucher-preview.dto';
import { VoucherPreviewView } from './orders.repository';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(UserRoleEnum.CUSTOMER)
  @Post('voucher-preview')
  @RateLimit({
    limit: 30,
    windowSeconds: 60,
    scope: 'identity',
    keyPrefix: 'orders:voucher-preview',
  })
  async previewVoucher(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VoucherPreviewDto,
  ): Promise<ApiResponseData<VoucherPreviewView>> {
    return {
      status: true,
      message: 'Áp dụng voucher thành công!',
      data: await this.ordersService.previewVoucher(req.user.id!, dto),
      code: 200,
    };
  }

  @Get('my')
  async getMyOrders(
    @Req() req: AuthenticatedRequest,
    @Query() query: OrderQueryDto,
  ): Promise<ApiResponseData<PaginatedData<OrderSummaryView>>> {
    return {
      status: true,
      message: 'Lấy danh sách đơn hàng thành công!',
      data: await this.ordersService.getMyOrders(req.user.id!, query),
      code: 200,
    };
  }

  @Get('my/:id')
  async getMyOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: 'Lấy chi tiết đơn hàng thành công!',
      data: await this.ordersService.getMyOrder(req.user.id!, id),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.CUSTOMER)
  @Patch('my/:id/cancel')
  async cancelMyOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelMyOrderDto,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: 'Hủy đơn hàng thành công và đã hoàn lại tồn kho!',
      data: await this.ordersService.cancelMyOrder(
        req.user.id!,
        id,
        dto.reason,
      ),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.CUSTOMER)
  @Patch('my/:id/return-request')
  @RateLimit({
    limit: 5,
    windowSeconds: 3600,
    scope: 'identity',
    keyPrefix: 'orders:return-request',
  })
  async requestReturn(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestOrderReturnDto,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: 'Đã gửi yêu cầu hoàn trả hàng!',
      data: await this.ordersService.requestReturn(
        req.user.id!,
        id,
        dto.reason,
        dto.evidence,
      ),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Get('management')
  async getManagementOrders(
    @Query() query: OrderQueryDto,
  ): Promise<ApiResponseData<PaginatedData<OrderSummaryView>>> {
    return {
      status: true,
      message: 'Lấy danh sách quản lý đơn hàng thành công!',
      data: await this.ordersService.getManagementOrders(query),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Get('management/:id')
  async getManagementOrder(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: 'Lấy chi tiết đơn hàng thành công!',
      data: await this.ordersService.getManagementOrder(id),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Patch('management/:id/status')
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: 'Cập nhật trạng thái đơn hàng thành công!',
      data: await this.ordersService.updateStatus(id, dto.status, req.user.id),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Patch('management/:id/reject')
  async reject(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: 'Từ chối đơn hàng thành công!',
      data: await this.ordersService.reject(id, dto.reason, req.user.id!),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Patch('management/:id/return-review')
  async reviewReturn(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewOrderReturnDto,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: dto.approved
        ? 'Đã xác nhận hoàn trả và hoàn lại tồn kho!'
        : 'Đã từ chối yêu cầu hoàn trả!',
      data: await this.ordersService.reviewReturn(
        id,
        dto.approved,
        dto.reason,
        req.user.id!,
      ),
      code: 200,
    };
  }

  @Post('from-cart')
  @RateLimit({
    limit: 10,
    windowSeconds: 60,
    scope: 'identity',
    keyPrefix: 'orders:create',
  })
  async createFromCart(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateOrderFromCartDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: 'Đặt hàng từ giỏ hàng thành công!',
      data: await this.ordersService.createFromCart(
        req.user.id!,
        dto,
        idempotencyKey,
      ),
      code: 201,
    };
  }

  @Post('buy-now')
  @RateLimit({
    limit: 10,
    windowSeconds: 60,
    scope: 'identity',
    keyPrefix: 'orders:create',
  })
  async buyNow(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BuyNowOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ApiResponseData<OrderView>> {
    return {
      status: true,
      message: 'Mua ngay thành công!',
      data: await this.ordersService.buyNow(req.user.id!, dto, idempotencyKey),
      code: 201,
    };
  }
}
