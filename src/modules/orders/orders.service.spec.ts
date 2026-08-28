import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '@entities';
import { OrderCreationError, OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: {
    createFromCart: jest.Mock;
    createBuyNow: jest.Mock;
    findStatus: jest.Mock;
    updateStatus: jest.Mock;
    reject: jest.Mock;
  };

  const order = {
    id: '10000000-0000-4000-8000-000000000001',
    orderCode: 'ORD-TEST',
    userId: '20000000-0000-4000-8000-000000000001',
    status: OrderStatus.PENDING,
    totalAmount: 100000,
    shippingAddress: '1 Đường thử nghiệm',
    recipientName: 'Nguyễn Văn A',
    recipientPhone: '0900000000',
    note: null,
    createdAt: new Date(),
    items: [],
  };

  beforeEach(async () => {
    repository = {
      createFromCart: jest.fn().mockResolvedValue(order),
      createBuyNow: jest.fn().mockResolvedValue(order),
      findStatus: jest.fn().mockResolvedValue(OrderStatus.PENDING),
      updateStatus: jest.fn().mockResolvedValue({
        ...order,
        status: OrderStatus.CONFIRMED,
      }),
      reject: jest.fn().mockResolvedValue({
        ...order,
        status: OrderStatus.REJECTED,
        rejectionReason: 'Không thể xác minh người nhận',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  it('creates an order from the authenticated user cart', async () => {
    await expect(
      service.createFromCart(order.userId, recipient()),
    ).resolves.toEqual(order);
    expect(repository.createFromCart).toHaveBeenCalledWith(
      order.userId,
      recipient(),
    );
  });

  it('requires a product reference for buy now', async () => {
    await expect(
      service.buyNow(order.userId, { ...recipient(), quantity: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the selected variant in buy now input', async () => {
    const item = {
      ...recipient(),
      productSku: 'PHONE-01',
      variantSku: 'PHONE-01-BLACK',
      quantity: 2,
    };
    await service.buyNow(order.userId, item);
    expect(repository.createBuyNow).toHaveBeenCalledWith(
      order.userId,
      recipient(),
      {
        productId: undefined,
        productSku: 'PHONE-01',
        variantId: undefined,
        variantSku: 'PHONE-01-BLACK',
        quantity: 2,
      },
    );
  });

  it('maps insufficient stock to conflict response', async () => {
    repository.createFromCart.mockRejectedValue(
      new OrderCreationError('STOCK_EXCEEDED', 'Không đủ tồn kho'),
    );
    await expect(
      service.createFromCart(order.userId, recipient()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('moves an order only to the next lifecycle status', async () => {
    await expect(
      service.updateStatus(order.id, OrderStatus.CONFIRMED),
    ).resolves.toMatchObject({ status: OrderStatus.CONFIRMED });
    expect(repository.updateStatus).toHaveBeenCalledWith(
      order.id,
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
    );
  });

  it('rejects skipping lifecycle statuses', async () => {
    await expect(
      service.updateStatus(order.id, OrderStatus.SHIPPING),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects a pending order with its reason and actor', async () => {
    await expect(
      service.reject(order.id, ' Không thể xác minh người nhận ', order.userId),
    ).resolves.toMatchObject({ status: OrderStatus.REJECTED });
    expect(repository.reject).toHaveBeenCalledWith(
      order.id,
      'Không thể xác minh người nhận',
      order.userId,
    );
  });
});

function recipient() {
  return {
    recipientName: 'Nguyễn Văn A',
    recipientPhone: '0900000000',
    shippingAddress: '1 Đường thử nghiệm',
  };
}
