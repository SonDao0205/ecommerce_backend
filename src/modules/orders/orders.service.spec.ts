import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '@entities';
import { OrderCreationError, OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { SepayService } from '../payments/sepay.service';
import { ConfigService } from '@nestjs/config';
import { OrderEmailService } from '../email/order-email.service';

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
  let orderEmail: {
    sendOrderConfirmation: jest.Mock;
    sendOrderCancellation: jest.Mock;
    sendOrderReturnUpdate: jest.Mock;
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
    orderEmail = {
      sendOrderConfirmation: jest.fn().mockResolvedValue(undefined),
      sendOrderCancellation: jest.fn().mockResolvedValue(undefined),
      sendOrderReturnUpdate: jest.fn().mockResolvedValue(undefined),
    };
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
        {
          provide: SepayService,
          useValue: {
            assertConfigured: jest.fn(),
            buildCheckout: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (_key: string, fallback?: unknown): unknown => fallback,
            ),
          },
        },
        {
          provide: OrderEmailService,
          useValue: orderEmail,
        },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  it('creates an order from the authenticated user cart', async () => {
    await expect(
      service.createFromCart(order.userId, recipient(), idempotencyKey),
    ).resolves.toMatchObject(order);
    expect(repository.createFromCart).toHaveBeenCalledWith(
      order.userId,
      expect.objectContaining({ recipientName: 'Nguyễn Văn A' }),
      expect.objectContaining({ key: idempotencyKey }),
      expect.objectContaining({ method: PaymentMethod.COD, expiresAt: null }),
      undefined,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(orderEmail.sendOrderConfirmation).toHaveBeenCalledWith(order);
  });

  it('does not wait for the confirmation email before returning the order', async () => {
    orderEmail.sendOrderConfirmation.mockReturnValue(new Promise(() => {}));

    await expect(
      service.createFromCart(order.userId, recipient(), idempotencyKey),
    ).resolves.toMatchObject(order);
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
      expect.objectContaining({
        recipientName: 'Nguyễn Văn A',
        recipientPhone: '0900000000',
        shippingAddress: '1 Đường thử nghiệm',
      }),
      {
        productId: undefined,
        productSku: 'PHONE-01',
        variantId: undefined,
        variantSku: 'PHONE-01-BLACK',
        quantity: 2,
      },
      expect.objectContaining({ key: idempotencyKey }),
      expect.objectContaining({ method: PaymentMethod.COD, expiresAt: null }),
      undefined,
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

  it('does not confirm a SePay order before payment succeeds', async () => {
    repository.findById.mockResolvedValue({
      ...order,
      payment: {
        provider: PaymentProvider.SEPAY,
        status: PaymentStatus.PENDING,
      },
    });

    await expect(
      service.updateStatus(order.id, OrderStatus.CONFIRMED),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('does not progress an order after its SePay payment is refunded', async () => {
    repository.findById.mockResolvedValue({
      ...order,
      status: OrderStatus.CONFIRMED,
      payment: {
        provider: PaymentProvider.SEPAY,
        status: PaymentStatus.REFUNDED,
      },
    });

    await expect(
      service.updateStatus(order.id, OrderStatus.PROCESSING),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects a pending order with its reason and actor', async () => {
    const rejected = await service.reject(
      order.id,
      ' Không thể xác minh người nhận ',
      order.userId,
    );
    expect(rejected).toMatchObject({ status: OrderStatus.REJECTED });
    expect(repository.reject).toHaveBeenCalledWith(
      order.id,
      'Không thể xác minh người nhận',
      order.userId,
    );
    await flushBackgroundEmail();
    expect(orderEmail.sendOrderCancellation).toHaveBeenCalledWith(rejected);
  });

  it('allows the customer to cancel a pending order', async () => {
    const cancelled = await service.cancelMyOrder(
      order.userId,
      order.id,
      ' Không còn nhu cầu ',
    );
    expect(cancelled).toMatchObject({ status: OrderStatus.CANCELLED });
    expect(repository.cancelByCustomer).toHaveBeenCalledWith(
      order.id,
      order.userId,
      'Không còn nhu cầu',
    );
    await flushBackgroundEmail();
    expect(orderEmail.sendOrderCancellation).toHaveBeenCalledWith(cancelled);
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

    const returnRequest = await service.requestReturn(
      order.userId,
      order.id,
      'Sản phẩm bị lỗi',
      evidence,
    );
    expect(returnRequest).toMatchObject({
      status: OrderStatus.RETURN_REQUESTED,
    });
    expect(repository.requestReturn).toHaveBeenCalledWith(
      order.id,
      order.userId,
      'Sản phẩm bị lỗi',
      evidence,
    );
    await flushBackgroundEmail();
    expect(orderEmail.sendOrderReturnUpdate).toHaveBeenCalledWith(
      returnRequest,
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

    const returned = await service.reviewReturn(
      order.id,
      true,
      'Đã xác minh sản phẩm lỗi',
      order.userId,
    );
    expect(returned).toMatchObject({ status: OrderStatus.RETURNED });
    expect(repository.reviewReturn).toHaveBeenCalledWith(
      order.id,
      true,
      'Đã xác minh sản phẩm lỗi',
      order.userId,
    );
    await flushBackgroundEmail();
    expect(orderEmail.sendOrderReturnUpdate).toHaveBeenCalledWith(returned);
  });
});

function recipient() {
  return {
    recipientName: 'Nguyễn Văn A',
    recipientPhone: '0900000000',
    shippingAddress: '1 Đường thử nghiệm',
    paymentMethod: PaymentMethod.COD,
  };
}

function flushBackgroundEmail(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
