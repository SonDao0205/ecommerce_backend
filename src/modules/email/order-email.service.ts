import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomerAddress, OrderStatus, PaymentMethod, User } from '@entities';
import { Repository } from 'typeorm';
import { Resend } from 'resend';
import type { Transporter } from 'nodemailer';
import type { OrderView } from '../orders/orders.repository';
import { GMAIL_TRANSPORTER, RESEND_CLIENT } from './email.constants';

type EmailProvider = 'resend' | 'gmail';
interface OrderEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend | null,
    @Inject(GMAIL_TRANSPORTER)
    private readonly gmailTransporter: Transporter | null,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CustomerAddress)
    private readonly customerAddresses: Repository<CustomerAddress>,
    private readonly config: ConfigService,
  ) {}

  async sendOrderConfirmation(order: OrderView): Promise<void> {
    await this.sendOrderEmail(order, 'order-confirmation', (customerName) => ({
      subject: `Đặt hàng thành công - ${order.orderCode}`,
      html: this.renderHtml(order, customerName),
      text: this.renderText(order, customerName),
    }));
  }

  async sendOrderCancellation(order: OrderView): Promise<void> {
    const rejected = order.status === OrderStatus.REJECTED;
    const title = rejected ? 'Đơn hàng đã bị từ chối' : 'Đơn hàng đã được hủy';
    const reason = rejected ? order.rejectionReason : order.cancellationReason;
    await this.sendOrderEmail(
      order,
      rejected ? 'order-rejected' : 'order-cancelled',
      (customerName) => ({
        subject: `${title} - ${order.orderCode}`,
        html: this.renderStatusHtml(
          order,
          customerName,
          title,
          rejected
            ? 'Cửa hàng không thể tiếp nhận đơn hàng của bạn.'
            : 'Yêu cầu hủy đơn hàng của bạn đã được ghi nhận.',
          'Lý do',
          reason,
        ),
        text: this.renderStatusText(
          order,
          customerName,
          title,
          rejected
            ? 'Cửa hàng không thể tiếp nhận đơn hàng của bạn.'
            : 'Yêu cầu hủy đơn hàng của bạn đã được ghi nhận.',
          'Lý do',
          reason,
        ),
      }),
    );
  }

  async sendOrderReturnUpdate(order: OrderView): Promise<void> {
    const content =
      order.status === OrderStatus.RETURN_REQUESTED
        ? {
            event: 'return-requested',
            title: 'Đã tiếp nhận yêu cầu trả hàng',
            description:
              'Cửa hàng đã nhận được yêu cầu và sẽ kiểm tra trong thời gian sớm nhất.',
            reasonLabel: 'Lý do trả hàng',
            reason: order.returnReason,
          }
        : order.status === OrderStatus.RETURNED
          ? {
              event: 'return-approved',
              title: 'Yêu cầu trả hàng đã được chấp thuận',
              description:
                'Cửa hàng đã duyệt yêu cầu trả hàng của bạn. Vui lòng thực hiện theo hướng dẫn của cửa hàng.',
              reasonLabel: 'Phản hồi từ cửa hàng',
              reason: order.returnReviewReason,
            }
          : {
              event: 'return-rejected',
              title: 'Yêu cầu trả hàng không được chấp thuận',
              description:
                'Cửa hàng đã hoàn tất việc xem xét yêu cầu trả hàng của bạn.',
              reasonLabel: 'Phản hồi từ cửa hàng',
              reason: order.returnReviewReason,
            };
    await this.sendOrderEmail(order, content.event, (customerName) => ({
      subject: `${content.title} - ${order.orderCode}`,
      html: this.renderStatusHtml(
        order,
        customerName,
        content.title,
        content.description,
        content.reasonLabel,
        content.reason,
      ),
      text: this.renderStatusText(
        order,
        customerName,
        content.title,
        content.description,
        content.reasonLabel,
        content.reason,
      ),
    }));
  }

  private async sendOrderEmail(
    order: OrderView,
    event: string,
    buildContent: (customerName?: string | null) => {
      subject: string;
      html: string;
      text: string;
    },
  ): Promise<void> {
    const provider = this.emailProvider();
    if (!this.isProviderConfigured(provider, order.orderCode)) return;

    const user = await this.users.findOne({
      where: { id: order.userId },
      select: { email: true, fullName: true },
    });
    const accountEmail = user?.email?.trim();
    const defaultAddress = accountEmail
      ? null
      : await this.customerAddresses.findOne({
          where: { userId: order.userId, isDefault: true },
          select: { email: true },
        });
    const recipientEmail =
      accountEmail ||
      defaultAddress?.email?.trim() ||
      order.customerEmail?.trim();
    if (!recipientEmail) {
      this.logger.warn(
        `Bỏ qua email đơn ${order.orderCode}: tài khoản không có email`,
      );
      return;
    }

    const message: OrderEmailMessage = {
      to: recipientEmail,
      ...buildContent(user?.fullName),
      idempotencyKey: `${event}/${order.id}`,
    };

    if (provider === 'gmail') {
      await this.sendWithGmail(order, message);
      return;
    }
    await this.sendWithResend(order, message);
  }

  private async sendWithResend(
    order: OrderView,
    message: OrderEmailMessage,
  ): Promise<void> {
    const from = this.config.get<string>('RESEND_FROM_EMAIL')!.trim();
    const replyTo = this.config.get<string>('RESEND_REPLY_TO')?.trim();
    const { idempotencyKey, ...email } = message;
    const { data, error } = await this.resend!.emails.send(
      { from, ...email, ...(replyTo ? { replyTo } : {}) },
      { idempotencyKey },
    );

    if (error) {
      throw new Error(
        `Resend từ chối email đơn ${order.orderCode}: ${error.message}`,
      );
    }
    this.logger.log(
      `Đã gửi email đơn ${order.orderCode} qua Resend (${data?.id ?? 'không có id'})`,
    );
  }

  private async sendWithGmail(
    order: OrderView,
    message: OrderEmailMessage,
  ): Promise<void> {
    const address = this.config.get<string>('GMAIL_USER')!.trim();
    const name =
      this.config.get<string>('GMAIL_FROM_NAME')?.trim() || 'E-Commerce';
    const replyTo = this.config.get<string>('GMAIL_REPLY_TO')?.trim();
    const email = {
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    };
    const info: unknown = await this.gmailTransporter!.sendMail({
      from: { name, address },
      ...email,
      ...(replyTo ? { replyTo } : {}),
    });
    const messageId =
      typeof info === 'object' &&
      info !== null &&
      'messageId' in info &&
      typeof info.messageId === 'string'
        ? info.messageId
        : 'không có id';
    this.logger.log(
      `Đã gửi email đơn ${order.orderCode} qua Gmail (${messageId})`,
    );
  }

  private emailProvider(): EmailProvider {
    const value = this.config
      .get<string>('EMAIL_PROVIDER', 'resend')
      .trim()
      .toLowerCase();
    if (value === 'resend' || value === 'gmail') return value;
    this.logger.warn(`EMAIL_PROVIDER="${value}" không hợp lệ; sử dụng Resend`);
    return 'resend';
  }

  private isProviderConfigured(
    provider: EmailProvider,
    orderCode: string,
  ): boolean {
    if (provider === 'gmail') {
      if (
        this.gmailTransporter &&
        this.config.get<string>('GMAIL_USER')?.trim()
      )
        return true;
      this.logger.warn(
        `Bỏ qua email đơn ${orderCode}: chưa cấu hình GMAIL_USER hoặc GMAIL_APP_PASSWORD`,
      );
      return false;
    }
    if (this.resend && this.config.get<string>('RESEND_FROM_EMAIL')?.trim())
      return true;
    this.logger.warn(
      `Bỏ qua email đơn ${orderCode}: chưa cấu hình RESEND_API_KEY hoặc RESEND_FROM_EMAIL`,
    );
    return false;
  }

  private renderHtml(order: OrderView, customerName?: string | null): string {
    const itemRows = order.items
      .map(
        (item) => `<tr>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb">
            ${this.escapeHtml(item.productName)}${item.variantValue ? `<br><small style="color:#6b7280">${this.escapeHtml(item.variantValue)}</small>` : ''}
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${this.money(item.unitPrice)}</td>
          <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${this.money(item.subtotal)}</td>
        </tr>`,
      )
      .join('');
    const displayName = customerName || order.recipientName;

    return `<!doctype html>
<html lang="vi"><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border-radius:12px;padding:28px">
      <h1 style="margin:0 0 12px;font-size:24px">Đặt hàng thành công</h1>
      <p>Xin chào ${this.escapeHtml(displayName)},</p>
      <p>Cảm ơn bạn đã đặt hàng. Đơn <strong>${this.escapeHtml(order.orderCode)}</strong> đã được tiếp nhận vào ${this.date(order.createdAt)}.</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
        <thead><tr style="background:#f9fafb">
          <th style="padding:10px 8px;text-align:left">Sản phẩm</th><th style="padding:10px 8px">SL</th>
          <th style="padding:10px 8px;text-align:right">Đơn giá</th><th style="padding:10px 8px;text-align:right">Thành tiền</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="margin-left:auto;max-width:320px;font-size:14px">
        <p>Tạm tính: <strong style="float:right">${this.money(order.subtotalAmount)}</strong></p>
        <p>Giảm giá: <strong style="float:right">-${this.money(order.discountAmount)}</strong></p>
        <p style="font-size:18px;border-top:1px solid #e5e7eb;padding-top:12px">Tổng cộng: <strong style="float:right">${this.money(order.totalAmount)}</strong></p>
      </div>
      <h2 style="font-size:17px;margin-top:28px">Thông tin nhận hàng</h2>
      <p style="line-height:1.7">${this.escapeHtml(order.recipientName)} · ${this.escapeHtml(order.recipientPhone)}<br>${this.escapeHtml(order.shippingAddress)}</p>
      <p>Thanh toán: <strong>${this.paymentMethod(order.payment?.method)}</strong></p>
      ${order.note ? `<p>Ghi chú: ${this.escapeHtml(order.note)}</p>` : ''}
    </div>
  </div>
</body></html>`;
  }

  private renderText(order: OrderView, customerName?: string | null): string {
    const items = order.items
      .map(
        (item) =>
          `- ${item.productName}${item.variantValue ? ` (${item.variantValue})` : ''} x${item.quantity}: ${this.money(item.subtotal)}`,
      )
      .join('\n');
    return `Xin chào ${customerName || order.recipientName},

Đơn hàng ${order.orderCode} của bạn đã được đặt thành công.

${items}

Tạm tính: ${this.money(order.subtotalAmount)}
Giảm giá: -${this.money(order.discountAmount)}
Tổng cộng: ${this.money(order.totalAmount)}

Người nhận: ${order.recipientName} - ${order.recipientPhone}
Địa chỉ: ${order.shippingAddress}
Thanh toán: ${this.paymentMethod(order.payment?.method)}${order.note ? `\nGhi chú: ${order.note}` : ''}`;
  }

  private renderStatusHtml(
    order: OrderView,
    customerName: string | null | undefined,
    title: string,
    description: string,
    reasonLabel: string,
    reason?: string | null,
  ): string {
    const displayName = customerName || order.recipientName;
    return `<!doctype html>
<html lang="vi"><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border-radius:12px;padding:28px">
      <h1 style="margin:0 0 12px;font-size:24px">${this.escapeHtml(title)}</h1>
      <p>Xin chào ${this.escapeHtml(displayName)},</p>
      <p>${this.escapeHtml(description)}</p>
      <div style="margin:24px 0;padding:18px;background:#f9fafb;border-radius:8px;line-height:1.7">
        <strong>Mã đơn hàng:</strong> ${this.escapeHtml(order.orderCode)}<br>
        <strong>Tổng giá trị:</strong> ${this.money(order.totalAmount)}<br>
        <strong>${this.escapeHtml(reasonLabel)}:</strong> ${this.escapeHtml(reason?.trim() || 'Không có thông tin')}
      </div>
      <p>Nếu cần hỗ trợ thêm, vui lòng phản hồi email này hoặc liên hệ cửa hàng.</p>
    </div>
  </div>
</body></html>`;
  }

  private renderStatusText(
    order: OrderView,
    customerName: string | null | undefined,
    title: string,
    description: string,
    reasonLabel: string,
    reason?: string | null,
  ): string {
    return `${title}

Xin chào ${customerName || order.recipientName},

${description}

Mã đơn hàng: ${order.orderCode}
Tổng giá trị: ${this.money(order.totalAmount)}
${reasonLabel}: ${reason?.trim() || 'Không có thông tin'}

Nếu cần hỗ trợ thêm, vui lòng phản hồi email này hoặc liên hệ cửa hàng.`;
  }

  private money(value?: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  }

  private date(value: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(value));
  }

  private paymentMethod(method?: PaymentMethod): string {
    const labels: Partial<Record<PaymentMethod, string>> = {
      [PaymentMethod.COD]: 'Thanh toán khi nhận hàng (COD)',
      [PaymentMethod.SEPAY_BANK_TRANSFER]: 'Chuyển khoản ngân hàng qua SePay',
      [PaymentMethod.SEPAY_CARD]: 'Thẻ qua SePay',
      [PaymentMethod.SEPAY_NAPAS]: 'Napas qua SePay',
    };
    return method ? labels[method] || method : 'Chưa xác định';
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[character]!,
    );
  }
}
