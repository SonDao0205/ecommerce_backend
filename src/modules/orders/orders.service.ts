import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';
import { OrderStatus } from '@entities';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { BuyNowOrderDto, CreateOrderFromCartDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import {
  OrderCreationError,
  OrdersRepository,
  OrderSummaryView,
  OrderView,
} from './orders.repository';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { DASHBOARD_CACHE_VERSION_KEY } from '../dashboard/dashboard-cache.constants';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly cache: RedisCacheService,
  ) {}

  getManagementOrders(
    query: OrderQueryDto,
  ): Promise<PaginatedData<OrderSummaryView>> {
    return this.ordersRepository.findAll(query);
  }

  getMyOrders(
    userId: string,
    query: OrderQueryDto,
  ): Promise<PaginatedData<OrderSummaryView>> {
    return this.ordersRepository.findAll(query, userId);
  }

  async getManagementOrder(id: string): Promise<OrderView> {
    const order = await this.ordersRepository.findById(id);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');
    return order;
  }

  async getMyOrder(userId: string, id: string): Promise<OrderView> {
    const order = await this.ordersRepository.findById(id, userId);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');
    return order;
  }

  async updateStatus(
    id: string,
    nextStatus: OrderStatus,
    actorId?: string,
  ): Promise<OrderView> {
    if (nextStatus === OrderStatus.REJECTED) {
      throw new BadRequestException(
        'Hãy sử dụng chức năng từ chối và nhập lý do từ chối!',
      );
    }
    const currentStatus = await this.ordersRepository.findStatus(id);
    if (!currentStatus) throw new NotFoundException('Không tìm thấy đơn hàng!');
    const allowedNextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
      [OrderStatus.PENDING]: OrderStatus.CONFIRMED,
      [OrderStatus.CONFIRMED]: OrderStatus.PROCESSING,
      [OrderStatus.PROCESSING]: OrderStatus.SHIPPING,
      [OrderStatus.SHIPPING]: OrderStatus.COMPLETED,
    };
    if (allowedNextStatus[currentStatus] !== nextStatus) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ “${currentStatus}” sang “${nextStatus}”!`,
      );
    }
    const order = actorId
      ? await this.ordersRepository.updateStatus(
          id,
          currentStatus,
          nextStatus,
          actorId,
        )
      : await this.ordersRepository.updateStatus(id, currentStatus, nextStatus);
    if (!order) {
      throw new ConflictException(
        'Trạng thái đơn hàng vừa thay đổi. Vui lòng tải lại dữ liệu!',
      );
    }
    await this.invalidateDashboard();
    return order;
  }

  async reject(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<OrderView> {
    const currentStatus = await this.ordersRepository.findStatus(id);
    if (!currentStatus) throw new NotFoundException('Không tìm thấy đơn hàng!');
    if (currentStatus !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể từ chối đơn hàng đang chờ xác nhận!',
      );
    }
    const order = await this.ordersRepository.reject(
      id,
      reason.trim(),
      actorId,
    );
    if (!order) {
      throw new ConflictException(
        'Trạng thái đơn hàng vừa thay đổi. Vui lòng tải lại dữ liệu!',
      );
    }
    await this.invalidateDashboard();
    return order;
  }

  async createFromCart(
    userId: string,
    dto: CreateOrderFromCartDto,
    idempotencyKey?: string,
  ): Promise<OrderView> {
    const idempotency = this.idempotency(idempotencyKey, 'from-cart', dto);
    try {
      const order = await this.ordersRepository.createFromCart(
        userId,
        this.recipient(dto),
        idempotency,
      );
      await this.invalidateDashboard();
      return order;
    } catch (error) {
      this.rethrowOrderError(error);
    }
  }

  async buyNow(
    userId: string,
    dto: BuyNowOrderDto,
    idempotencyKey?: string,
  ): Promise<OrderView> {
    if (!dto.productId && !dto.productSku?.trim()) {
      throw new BadRequestException('Cần cung cấp productId hoặc productSku!');
    }
    const idempotency = this.idempotency(idempotencyKey, 'buy-now', dto);
    try {
      const order = await this.ordersRepository.createBuyNow(
        userId,
        this.recipient(dto),
        {
          productId: dto.productId,
          productSku: dto.productSku?.trim(),
          variantId: dto.variantId,
          variantSku: dto.variantSku?.trim(),
          quantity: dto.quantity,
        },
        idempotency,
      );
      await this.invalidateDashboard();
      return order;
    } catch (error) {
      this.rethrowOrderError(error);
    }
  }

  private async invalidateDashboard(): Promise<void> {
    await this.cache.increment(DASHBOARD_CACHE_VERSION_KEY);
  }

  private recipient(dto: CreateOrderFromCartDto) {
    return {
      recipientName: dto.recipientName.trim(),
      recipientPhone: dto.recipientPhone.trim(),
      shippingAddress: dto.shippingAddress.trim(),
      note: dto.note?.trim() || undefined,
    };
  }

  private idempotency(
    key: string | undefined,
    operation: 'from-cart' | 'buy-now',
    payload: CreateOrderFromCartDto | BuyNowOrderDto,
  ): { key: string; fingerprint: string } {
    const normalizedKey = key?.trim();
    if (!normalizedKey || !isUUID(normalizedKey)) {
      throw new BadRequestException(
        'Header Idempotency-Key là UUID và không được để trống!',
      );
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ operation, payload }))
      .digest('hex');
    return { key: normalizedKey, fingerprint };
  }

  private rethrowOrderError(error: unknown): never {
    if (!(error instanceof OrderCreationError)) throw error;
    if (error.code === 'IDEMPOTENCY_KEY_REUSED') {
      throw new ConflictException(error.message);
    }
    if (error.code === 'PRODUCT_UNAVAILABLE') {
      throw new NotFoundException(error.message);
    }
    if (error.code === 'STOCK_EXCEEDED' || error.code === 'INVENTORY_MISSING') {
      throw new ConflictException(error.message);
    }
    throw new BadRequestException(error.message);
  }
}
