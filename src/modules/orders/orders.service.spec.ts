import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '@entities';
import { OrderCreationError, OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { RedisCacheService } from '@common/cache/redis-cache.service';

describe('OrdersService', () => {
  const idempotencyKey = '30000000-0000-4000-8000-000000000001';
  let service: OrdersService;
  let repository: {
    createFromCart: jest.Mock;
    createBuyNow: jest.Mock;
    findStatus: jest.Mock;
    findById: jest.Mock;
    updateStatus: jest.Mock;
    reject: jest.Mock;
    cancelByCustomer: jest.Mock;
    requestReturn: jest.Mock;
    reviewReturn: jest.Mock;
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
      findById: jest.fn().mockResolvedValue(order),
      updateStatus: jest.fn().mockResolvedValue({
        ...order,
        status: OrderStatus.CONFIRMED,
      }),
      reject: jest.fn().mockResolvedValue({
        ...order,
        status: OrderStatus.REJECTED,
        rejectionReason: 'Không thể xác minh người nhận',
      }),
      cancelByCustomer: jest.fn().mockResolvedValue({
        ...order,
        status: OrderStatus.CANCELLED,
      }),
      requestReturn: jest.fn(),
      reviewReturn: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: repository },
        {
          provide: RedisCacheService,
          useValue: { increment: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  it('creates an order from the authenticated user cart', async () => {
    await expect(
      service.createFromCart(order.userId, recipient(), idempotencyKey),
    ).resolves.toEqual(order);
    expect(repository.createFromCart).toHaveBeenCalledWith(
      order.userId,
      recipient(),
      expect.objectContaining({ key: idempotencyKey }),
    );
  });

  it('requires a product reference for buy now', async () => {
    await expect(
      service.buyNow(
        order.userId,
        { ...recipient(), quantity: 1 },
        idempotencyKey,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the selected variant in buy now input', async () => {
    const item = {
      ...recipient(),
      productSku: 'PHONE-01',
      variantSku: 'PHONE-01-BLACK',
      quantity: 2,
    };
    await service.buyNow(order.userId, item, idempotencyKey);
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
      expect.objectContaining({ key: idempotencyKey }),
    );
  });

  it('maps insufficient stock to conflict response', async () => {
    repository.createFromCart.mockRejectedValue(
      new OrderCreationError('STOCK_EXCEEDED', 'Không đủ tồn kho'),
    );
    await expect(
      service.createFromCart(order.userId, recipient(), idempotencyKey),
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

  it('allows the customer to cancel a pending order', async () => {
    await expect(
      service.cancelMyOrder(order.userId, order.id, ' Không còn nhu cầu '),
    ).resolves.toMatchObject({ status: OrderStatus.CANCELLED });
    expect(repository.cancelByCustomer).toHaveBeenCalledWith(
      order.id,
      order.userId,
      'Không còn nhu cầu',
    );
  });

  it('accepts a return request within seven days of confirmation', async () => {
    const completed = {
      ...order,
      status: OrderStatus.COMPLETED,
      confirmedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    };
    const evidence = [
      {
        url: `https://res.cloudinary.com/demo/image/upload/v1/ecommerce/returns/${order.userId}/proof.jpg`,
        publicId: `ecommerce/returns/${order.userId}/proof`,
        resourceType: 'image' as const,
      },
    ];
    repository.findById.mockResolvedValue(completed);
    repository.requestReturn.mockResolvedValue({
      ...completed,
      status: OrderStatus.RETURN_REQUESTED,
      returnEvidence: evidence,
    });

    await expect(
      service.requestReturn(
        order.userId,
        order.id,
        'Sản phẩm bị lỗi',
        evidence,
      ),
    ).resolves.toMatchObject({ status: OrderStatus.RETURN_REQUESTED });
    expect(repository.requestReturn).toHaveBeenCalledWith(
      order.id,
      order.userId,
      'Sản phẩm bị lỗi',
      evidence,
    );
  });

  it('rejects a return request after the seven-day window', async () => {
    repository.findById.mockResolvedValue({
      ...order,
      status: OrderStatus.COMPLETED,
      confirmedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    await expect(
      service.requestReturn(order.userId, order.id, 'Sản phẩm bị lỗi'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.requestReturn).not.toHaveBeenCalled();
  });

  it('restocks through repository only when admin approves the return', async () => {
    repository.findById.mockResolvedValue({
      ...order,
      status: OrderStatus.RETURN_REQUESTED,
    });
    repository.reviewReturn.mockResolvedValue({
      ...order,
      status: OrderStatus.RETURNED,
    });

    await expect(
      service.reviewReturn(
        order.id,
        true,
        'Đã xác minh sản phẩm lỗi',
        order.userId,
      ),
    ).resolves.toMatchObject({ status: OrderStatus.RETURNED });
    expect(repository.reviewReturn).toHaveBeenCalledWith(
      order.id,
      true,
      'Đã xác minh sản phẩm lỗi',
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
