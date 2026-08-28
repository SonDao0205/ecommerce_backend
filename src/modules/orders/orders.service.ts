import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

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
    return order;
  }

  async createFromCart(
    userId: string,
    dto: CreateOrderFromCartDto,
  ): Promise<OrderView> {
    try {
      return await this.ordersRepository.createFromCart(
        userId,
        this.recipient(dto),
      );
    } catch (error) {
      this.rethrowOrderError(error);
    }
  }

  async buyNow(userId: string, dto: BuyNowOrderDto): Promise<OrderView> {
    if (!dto.productId && !dto.productSku?.trim()) {
      throw new BadRequestException('Cần cung cấp productId hoặc productSku!');
    }
    try {
      return await this.ordersRepository.createBuyNow(
        userId,
        this.recipient(dto),
        {
          productId: dto.productId,
          productSku: dto.productSku?.trim(),
          variantId: dto.variantId,
          variantSku: dto.variantSku?.trim(),
          quantity: dto.quantity,
        },
      );
    } catch (error) {
      this.rethrowOrderError(error);
    }
  }

  private recipient(dto: CreateOrderFromCartDto) {
    return {
      recipientName: dto.recipientName.trim(),
      recipientPhone: dto.recipientPhone.trim(),
      shippingAddress: dto.shippingAddress.trim(),
      note: dto.note?.trim() || undefined,
    };
  }

  private rethrowOrderError(error: unknown): never {
    if (!(error instanceof OrderCreationError)) throw error;
    if (error.code === 'PRODUCT_UNAVAILABLE') {
      throw new NotFoundException(error.message);
    }
    if (error.code === 'STOCK_EXCEEDED' || error.code === 'INVENTORY_MISSING') {
      throw new ConflictException(error.message);
    }
    throw new BadRequestException(error.message);
  }
}
