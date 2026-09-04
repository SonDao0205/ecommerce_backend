import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '@entities';
import type { Resend } from 'resend';
import type { Transporter } from 'nodemailer';
import type { Repository } from 'typeorm';
import type { User } from '@entities';
import type { CustomerAddress } from '@entities';
import type { OrderView } from '../orders/orders.repository';
import { OrderEmailService } from './order-email.service';

describe('OrderEmailService', () => {
  const order: OrderView = {
    id: '10000000-0000-4000-8000-000000000001',
    orderCode: 'ORD-TEST',
    userId: '20000000-0000-4000-8000-000000000001',
    status: 'pending' as OrderView['status'],
    totalAmount: 180000,
    subtotalAmount: 200000,
    discountAmount: 20000,
    voucherId: null,
    voucherCode: null,
    shippingAddress: '1 Đường <Thử nghiệm>',
    recipientName: 'Nguyễn Văn A',
    recipientPhone: '0900000000',
    note: '<script>alert(1)</script>',
    rejectionReason: null,
    rejectedAt: null,
    confirmedAt: null,
    cancellationReason: null,
    cancelledAt: null,
    cancelledBy: null,
    returnReason: null,
    returnEvidence: [],
    returnRequestedAt: null,
    returnReviewReason: null,
    returnReviewedAt: null,
    returnReviewedBy: null,
    stockRestoredAt: null,
    createdAt: new Date('2026-09-03T01:00:00.000Z'),
    updatedAt: new Date('2026-09-03T01:00:00.000Z'),
    payment: {
      id: '30000000-0000-4000-8000-000000000001',
      orderId: '10000000-0000-4000-8000-000000000001',
      amount: 180000,
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.COD,
      method: PaymentMethod.COD,
      invoiceNumber: 'INV-TEST',
      providerOrderId: null,
      transactionId: null,
      currency: 'VND',
      attemptNumber: 1,
      expiresAt: null,
      paidAt: null,
      failedAt: null,
      cancelledAt: null,
      lastVerifiedAt: null,
      createdAt: new Date('2026-09-03T01:00:00.000Z'),
      updatedAt: new Date('2026-09-03T01:00:00.000Z'),
    },
    items: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        productId: '50000000-0000-4000-8000-000000000001',
        variantId: null,
        productName: 'Áo <đỏ>',
        variantName: null,
        variantValue: null,
        variantSku: null,
        unitPrice: 100000,
        quantity: 2,
        subtotal: 200000,
        reviewId: null,
      },
    ],
  };

  it('sends complete order details with a stable idempotency key', async () => {
    let sentPayload: unknown;
    let sentOptions: unknown;
    const send = jest.fn((payload: unknown, options: unknown) => {
      sentPayload = payload;
      sentOptions = options;
      return Promise.resolve({ data: { id: 'email-id' }, error: null });
    });
    const findDefaultAddress = jest.fn();
    const service = new OrderEmailService(
      { emails: { send } } as unknown as Resend,
      null,
      {
        findOne: jest.fn().mockResolvedValue({
          email: 'customer@example.com',
          fullName: 'Khách hàng',
        }),
      } as unknown as Repository<User>,
      {
        findOne: findDefaultAddress,
      } as unknown as Repository<CustomerAddress>,
      config({
        RESEND_FROM_EMAIL: 'Shop <orders@example.com>',
        RESEND_REPLY_TO: 'support@example.com',
      }),
    );

    await service.sendOrderConfirmation({
      ...order,
      customerEmail: 'stale-order-email@example.com',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = sentPayload as {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
      replyTo: string;
    };
    expect(payload.from).toBe('Shop <orders@example.com>');
    expect(payload.to).toBe('customer@example.com');
    expect(findDefaultAddress).not.toHaveBeenCalled();
    expect(payload.subject).toBe('Đặt hàng thành công - ORD-TEST');
    expect(payload.text).toContain('Tổng cộng: 180.000 ₫');
    expect(payload.html).toContain('Áo &lt;đỏ&gt;');
    expect(payload.replyTo).toBe('support@example.com');
    expect(payload.html).not.toContain('<script>');
    expect(sentOptions).toEqual({
      idempotencyKey: `order-confirmation/${order.id}`,
    });
  });

  it('sends the same order email through Gmail when selected', async () => {
    let sentPayload: unknown;
    const sendMail = jest.fn((payload: unknown) => {
      sentPayload = payload;
      return Promise.resolve({ messageId: '<gmail-message-id>' });
    });
    const service = new OrderEmailService(
      null,
      { sendMail } as unknown as Transporter,
      {
        findOne: jest.fn().mockResolvedValue({
          email: 'customer@example.com',
          fullName: 'Khách hàng',
        }),
      } as unknown as Repository<User>,
      { findOne: jest.fn() } as unknown as Repository<CustomerAddress>,
      config({
        EMAIL_PROVIDER: 'gmail',
        GMAIL_USER: 'shop@gmail.com',
        GMAIL_FROM_NAME: 'Cửa hàng',
        GMAIL_REPLY_TO: 'support@example.com',
      }),
    );

    await service.sendOrderConfirmation(order);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const payload = sentPayload as {
      from: { name: string; address: string };
      to: string;
      subject: string;
      html: string;
      replyTo: string;
    };
    expect(payload.from).toEqual({
      name: 'Cửa hàng',
      address: 'shop@gmail.com',
    });
    expect(payload.to).toBe('customer@example.com');
    expect(payload.subject).toBe('Đặt hàng thành công - ORD-TEST');
    expect(payload.html).toContain('Áo &lt;đỏ&gt;');
    expect(payload.replyTo).toBe('support@example.com');
  });

  it('falls back to the default delivery profile after checking users.email', async () => {
    let sentPayload: unknown;
    const send = jest.fn((payload: unknown) => {
      sentPayload = payload;
      return Promise.resolve({ data: { id: 'email-id' }, error: null });
    });
    const findDefaultAddress = jest.fn().mockResolvedValue({
      email: 'delivery-profile@example.com',
    });
    const service = new OrderEmailService(
      { emails: { send } } as unknown as Resend,
      null,
      {
        findOne: jest.fn().mockResolvedValue({
          email: null,
          fullName: 'Khách hàng',
        }),
      } as unknown as Repository<User>,
      {
        findOne: findDefaultAddress,
      } as unknown as Repository<CustomerAddress>,
      config({ RESEND_FROM_EMAIL: 'Shop <orders@example.com>' }),
    );

    await service.sendOrderConfirmation(order);

    expect(findDefaultAddress).toHaveBeenCalledWith({
      where: { userId: order.userId, isDefault: true },
      select: { email: true },
    });
    expect((sentPayload as { to: string }).to).toBe(
      'delivery-profile@example.com',
    );
  });

  it('sends distinct cancellation and return lifecycle emails', async () => {
    const deliveries: Array<{ payload: unknown; options: unknown }> = [];
    const send = jest.fn((payload: unknown, options: unknown) => {
      deliveries.push({ payload, options });
      return Promise.resolve({ data: { id: 'email-id' }, error: null });
    });
    const service = new OrderEmailService(
      { emails: { send } } as unknown as Resend,
      null,
      {
        findOne: jest.fn().mockResolvedValue({
          email: 'customer@example.com',
          fullName: 'Khách hàng',
        }),
      } as unknown as Repository<User>,
      { findOne: jest.fn() } as unknown as Repository<CustomerAddress>,
      config({ RESEND_FROM_EMAIL: 'Shop <orders@example.com>' }),
    );

    await service.sendOrderCancellation({
      ...order,
      status: OrderStatus.CANCELLED,
      cancellationReason: 'Không còn nhu cầu',
    });
    await service.sendOrderReturnUpdate({
      ...order,
      status: OrderStatus.RETURN_REQUESTED,
      returnReason: 'Sản phẩm bị lỗi',
    });
    await service.sendOrderReturnUpdate({
      ...order,
      status: OrderStatus.RETURNED,
      returnReviewReason: 'Đã xác minh lỗi',
    });

    const subjects = deliveries.map(
      ({ payload }) => (payload as { subject: string }).subject,
    );
    expect(subjects).toEqual([
      'Đơn hàng đã được hủy - ORD-TEST',
      'Đã tiếp nhận yêu cầu trả hàng - ORD-TEST',
      'Yêu cầu trả hàng đã được chấp thuận - ORD-TEST',
    ]);
    expect(deliveries.map(({ options }) => options)).toEqual([
      { idempotencyKey: `order-cancelled/${order.id}` },
      { idempotencyKey: `return-requested/${order.id}` },
      { idempotencyKey: `return-approved/${order.id}` },
    ]);
    expect((deliveries[0]?.payload as { text: string }).text).toContain(
      'Lý do: Không còn nhu cầu',
    );
  });

  it('does not query the user or send when Resend is not configured', async () => {
    const findOne = jest.fn();
    const service = new OrderEmailService(
      null,
      null,
      { findOne } as unknown as Repository<User>,
      { findOne } as unknown as Repository<CustomerAddress>,
      config({}),
    );

    await expect(service.sendOrderConfirmation(order)).resolves.toBeUndefined();
    expect(findOne).not.toHaveBeenCalled();
  });
});

function config(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}
