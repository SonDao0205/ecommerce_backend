import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentMethod, PaymentProvider } from '@entities';
import {
  PaymentView,
  SepayCheckout,
  SepayCheckoutFields,
  SepayIpnPayload,
} from './payment.types';

@Injectable()
export class SepayService {
  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    this.required('SEPAY_MERCHANT_ID');
    this.required('SEPAY_SECRET_KEY');
  }

  buildCheckout(
    payment: PaymentView,
    orderCode: string,
    customerId: string,
  ): SepayCheckout | null {
    if (payment.provider !== PaymentProvider.SEPAY) return null;
    if (payment.amount <= 0) return null;
    if (!Number.isInteger(payment.amount)) {
      throw new BadRequestException(
        'SePay chỉ hỗ trợ số tiền nguyên theo đơn vị VND',
      );
    }
    const merchant = this.required('SEPAY_MERCHANT_ID');
    const secret = this.required('SEPAY_SECRET_KEY');
    const returnBase = this.config
      .get<string>('SEPAY_RETURN_BASE_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    const fieldsWithoutSignature = {
      order_amount: String(payment.amount),
      merchant,
      currency: 'VND' as const,
      operation: 'PURCHASE' as const,
      order_description: `Thanh toán đơn hàng ${orderCode}`,
      order_invoice_number: payment.invoiceNumber,
      customer_id: customerId,
      payment_method: this.gatewayMethod(payment.method),
      success_url: `${returnBase}/payment/sepay/success?paymentId=${encodeURIComponent(payment.id)}`,
      error_url: `${returnBase}/payment/sepay/error?paymentId=${encodeURIComponent(payment.id)}`,
      cancel_url: `${returnBase}/payment/sepay/cancel?paymentId=${encodeURIComponent(payment.id)}`,
    };
    const signature = this.sign(fieldsWithoutSignature, secret);
    return {
      actionUrl: this.config.get<string>(
        'SEPAY_CHECKOUT_URL',
        this.environment() === 'production'
          ? 'https://pay.sepay.vn/v1/checkout/init'
          : 'https://pay-sandbox.sepay.vn/v1/checkout/init',
      ),
      fields: { ...fieldsWithoutSignature, signature },
    };
  }

  verifyIpnSecret(received?: string): void {
    const expected =
      this.config.get<string>('SEPAY_IPN_SECRET') ||
      this.config.get<string>('SEPAY_SECRET_KEY');
    if (!expected || !received)
      throw new UnauthorizedException('IPN không hợp lệ');
    const left = Buffer.from(received);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('IPN không hợp lệ');
    }
  }

  parseIpn(value: unknown): SepayIpnPayload {
    const raw = this.record(value, 'Payload IPN không hợp lệ');
    const order = this.record(raw.order, 'Thiếu thông tin đơn hàng SePay');
    const transaction = this.record(
      raw.transaction,
      'Thiếu thông tin giao dịch SePay',
    );
    const timestamp = this.number(raw.timestamp, 'timestamp');
    const maxSkew = Number(
      this.config.get<string>('SEPAY_IPN_MAX_SKEW_SECONDS', '900'),
    );
    if (Math.abs(Date.now() / 1000 - timestamp) > maxSkew) {
      throw new UnauthorizedException('IPN đã quá thời gian cho phép');
    }
    const notificationType = this.string(
      raw.notification_type,
      'notification_type',
    );
    if (
      notificationType !== 'ORDER_PAID' &&
      notificationType !== 'TRANSACTION_VOID'
    ) {
      throw new BadRequestException('Loại thông báo SePay không được hỗ trợ');
    }
    const payload: SepayIpnPayload = {
      timestamp,
      notificationType,
      order: {
        id: this.string(order.id, 'order.id'),
        orderId: this.string(order.order_id, 'order.order_id'),
        status: this.string(order.order_status, 'order.order_status'),
        currency: this.string(order.order_currency, 'order.order_currency'),
        amount: this.string(order.order_amount, 'order.order_amount'),
        invoiceNumber: this.string(
          order.order_invoice_number,
          'order.order_invoice_number',
        ),
      },
      transaction: {
        id: this.string(transaction.id, 'transaction.id'),
        transactionId: this.string(
          transaction.transaction_id,
          'transaction.transaction_id',
        ),
        status: this.string(
          transaction.transaction_status,
          'transaction.transaction_status',
        ),
        amount: this.string(
          transaction.transaction_amount,
          'transaction.transaction_amount',
        ),
        currency: this.string(
          transaction.transaction_currency,
          'transaction.transaction_currency',
        ),
        paymentMethod: this.string(
          transaction.payment_method,
          'transaction.payment_method',
        ),
        transactionDate:
          typeof transaction.transaction_date === 'string'
            ? transaction.transaction_date
            : null,
      },
      raw,
    };
    if (
      payload.notificationType === 'ORDER_PAID' &&
      (payload.order.status !== 'CAPTURED' ||
        payload.transaction.status !== 'APPROVED')
    ) {
      throw new BadGatewayException('SePay chưa xác nhận giao dịch thành công');
    }
    return payload;
  }

  private sign(
    fields: Omit<SepayCheckoutFields, 'signature'>,
    secret: string,
  ): string {
    const ordered: Array<keyof typeof fields> = [
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
    ];
    const signed = ordered.map((key) => `${key}=${fields[key]}`).join(',');
    return createHmac('sha256', secret).update(signed).digest('base64');
  }

  private gatewayMethod(method: PaymentMethod) {
    const methods: Partial<
      Record<PaymentMethod, SepayCheckoutFields['payment_method']>
    > = {
      [PaymentMethod.SEPAY_BANK_TRANSFER]: 'BANK_TRANSFER',
      [PaymentMethod.SEPAY_CARD]: 'CARD',
      [PaymentMethod.SEPAY_NAPAS]: 'NAPAS_BANK_TRANSFER',
    };
    const value = methods[method];
    if (!value) throw new BadRequestException('Phương thức SePay không hợp lệ');
    return value;
  }

  private environment() {
    return this.config.get<string>('SEPAY_ENV', 'sandbox') === 'production'
      ? 'production'
      : 'sandbox';
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) {
      throw new ServiceUnavailableException(
        `Thanh toán SePay chưa được cấu hình: thiếu ${key}`,
      );
    }
    return value;
  }

  private record(value: unknown, message: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(message);
    }
    return value as Record<string, unknown>;
  }

  private string(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`Thiếu trường ${field}`);
    }
    return value.trim();
  }

  private number(value: unknown, field: string): number {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new BadRequestException(`Trường ${field} không hợp lệ`);
    }
    return number;
  }
}
