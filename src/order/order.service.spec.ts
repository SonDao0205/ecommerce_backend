import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { OrderService } from './order.service.js';

const request = {
  address_id: 'address-1',
  payment_method_id: 'payment-1',
  shipping_method_id: 'shipping-1',
  items: [{ product_variant_id: 'variant-1', quantity: 1 }],
  voucher_codes: [],
  customer_note: undefined,
};

function requestHash(value: typeof request): string {
  const canonicalRequest = {
    address_id: value.address_id,
    payment_method_id: value.payment_method_id,
    shipping_method_id: value.shipping_method_id,
    items: [['variant-1', value.items[0].quantity]],
    voucher_codes: [],
    customer_note: null,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalRequest))
    .digest('hex');
}

function makeService(orderRepository: Record<string, any>, overrides = {}) {
  const dependencies = {
    dataSource: { transaction: vi.fn() },
    voucherService: {
      findAutomaticPlatformVoucher: vi.fn().mockResolvedValue(null),
      applyVouchers: vi.fn().mockResolvedValue({ final_amount: '10.00' }),
    },
    userService: {
      getAddressForUser: vi.fn().mockResolvedValue({ id: 'address-1' }),
    },
    paymentService: {
      getActiveMethod: vi.fn().mockResolvedValue({ id: 'payment-1' }),
    },
    shippingService: {
      getActiveMethod: vi
        .fn()
        .mockResolvedValue({ id: 'shipping-1', base_fee: '0.00' }),
    },
    productVariantService: {
      getOrderableVariants: vi.fn().mockResolvedValue([
        {
          id: 'variant-1',
          price: '10.00',
          product: { shop_id: 'shop-1' },
        },
      ]),
      lockOrderableVariants: vi.fn(),
      assertOrderQuantitiesAvailable: vi.fn(),
    },
    shopService: { createShopOrder: vi.fn() },
    orderItemService: { createItems: vi.fn() },
    orderRepository,
    ...overrides,
  };
  return {
    service: new OrderService(
      dependencies.dataSource as any,
      dependencies.voucherService as any,
      dependencies.userService as any,
      dependencies.paymentService as any,
      dependencies.shippingService as any,
      dependencies.productVariantService as any,
      dependencies.shopService as any,
      dependencies.orderItemService as any,
      dependencies.orderRepository as any,
    ),
    dependencies,
  };
}

describe('OrderService idempotency', () => {
  it('returns the created order for a retry with the same key and payload', async () => {
    const existing = { id: 'order-1', request_hash: requestHash(request) };
    const orderRepository = { findOne: vi.fn().mockResolvedValue(existing) };
    const { service, dependencies } = makeService(orderRepository);

    await expect(
      service.createOrder('user-1', request, 'request-key-1'),
    ).resolves.toBe(existing);
    expect(dependencies.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects reusing a key with a different payload', async () => {
    const existing = { id: 'order-1', request_hash: requestHash(request) };
    const orderRepository = { findOne: vi.fn().mockResolvedValue(existing) };
    const { service } = makeService(orderRepository);
    const changedRequest = {
      ...request,
      items: [{ product_variant_id: 'variant-1', quantity: 2 }],
    };

    await expect(
      service.createOrder('user-1', changedRequest, 'request-key-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechecks the key after waiting for the variant lock, before checking stock', async () => {
    const existing = { id: 'order-1', request_hash: requestHash(request) };
    const orderRepository = { findOne: vi.fn().mockResolvedValue(null) };
    const { service, dependencies } = makeService(orderRepository);
    const transactionalOrderRepository = {
      findOne: vi.fn().mockResolvedValue(existing),
    };
    dependencies.productVariantService.lockOrderableVariants.mockResolvedValue([
      {
        id: 'variant-1',
        price: '10.00',
        product: { shop_id: 'shop-1' },
      },
    ]);
    dependencies.dataSource.transaction.mockImplementation(async (callback) =>
      callback({ getRepository: () => transactionalOrderRepository } as any),
    );

    await expect(
      service.createOrder('user-1', request, 'request-key-1'),
    ).resolves.toBe(existing);
    expect(
      dependencies.productVariantService.assertOrderQuantitiesAvailable,
    ).not.toHaveBeenCalled();
  });

  it('returns the committed order when concurrent requests race on the unique key', async () => {
    const existing = { id: 'order-1', request_hash: requestHash(request) };
    const orderRepository = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing),
    };
    const { service, dependencies } = makeService(orderRepository);
    dependencies.dataSource.transaction.mockRejectedValue({
      driverError: {
        code: '23505',
        constraint: 'uq_orders_user_idempotency_key',
      },
    });

    await expect(
      service.createOrder('user-1', request, 'request-key-1'),
    ).resolves.toBe(existing);
    expect(orderRepository.findOne).toHaveBeenCalledTimes(2);
  });
});
