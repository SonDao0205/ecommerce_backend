import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PaymentMethod, PaymentProvider, PaymentStatus } from '@entities';
import { SepayService } from './sepay.service';

describe('SepayService', () => {
  const values: Record<string, string> = {
    SEPAY_ENV: 'sandbox',
    SEPAY_MERCHANT_ID: 'MERCHANT_TEST',
    SEPAY_SECRET_KEY: 'secret-test',
    SEPAY_IPN_SECRET: 'ipn-test',
    SEPAY_RETURN_BASE_URL: 'https://shop.example.com',
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
  const service = new SepayService(config);

  beforeEach(() => jest.clearAllMocks());

  it('creates the checkout signature in SePay field order', () => {
    const checkout = service.buildCheckout(
      {
        id: 'payment-id',
        orderId: 'order-id',
        amount: 150000,
        status: PaymentStatus.PENDING,
        provider: PaymentProvider.SEPAY,
        method: PaymentMethod.SEPAY_BANK_TRANSFER,
        invoiceNumber: 'PAY-ORDER-1',
        providerOrderId: null,
        transactionId: null,
        currency: 'VND',
        attemptNumber: 1,
        expiresAt: new Date(),
        paidAt: null,
        failedAt: null,
        cancelledAt: null,
        lastVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'ORD-001',
      'customer-id',
    )!;
    const fields = checkout.fields;
    const signed = [
      'order_amount',
      'merchant',
      'currency',
      'operation',
      'order_description',
      'order_invoice_number',
      'customer_id',
      'payment_method',
      'success_url',
      'error_url',
      'cancel_url',
    ]
      .map((key) => `${key}=${fields[key]}`)
      .join(',');

    expect(checkout.actionUrl).toBe(
      'https://pay-sandbox.sepay.vn/v1/checkout/init',
    );
    expect(fields.signature).toBe(
      createHmac('sha256', 'secret-test').update(signed).digest('base64'),
    );
  });

  it('rejects an invalid IPN secret', () => {
    expect(() => service.verifyIpnSecret('wrong')).toThrow(
      UnauthorizedException,
    );
  });

  it('parses a captured and approved payment IPN', () => {
    const payload = service.parseIpn({
      timestamp: Math.floor(Date.now() / 1000),
      notification_type: 'ORDER_PAID',
      order: {
        id: 'provider-id',
        order_id: 'SEPAY-ORDER',
        order_status: 'CAPTURED',
        order_currency: 'VND',
        order_amount: '150000.00',
        order_invoice_number: 'PAY-ORDER-1',
      },
      transaction: {
        id: 'transaction-record-id',
        transaction_id: 'BANK-TRANSACTION-ID',
        transaction_status: 'APPROVED',
        transaction_amount: '150000',
        transaction_currency: 'VND',
        payment_method: 'BANK_TRANSFER',
        transaction_date: '2026-09-01 10:00:00',
      },
    });

    expect(payload.order.invoiceNumber).toBe('PAY-ORDER-1');
    expect(payload.transaction.transactionId).toBe('BANK-TRANSACTION-ID');
  });
});
