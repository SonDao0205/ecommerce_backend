import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@entities';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { extractPostgresRows } from '@common/database/postgres-query-result';
import { PaymentView, SepayIpnPayload } from './payment.types';

interface PaymentRow {
  id: string;
  order_id: string;
  amount: number | string;
  status: PaymentStatus;
  provider: PaymentView['provider'];
  method: PaymentMethod;
  invoice_number: string;
  provider_order_id: string | null;
  transaction_id: string | null;
  currency: string;
  attempt_number: number;
  expires_at: Date | null;
  paid_at: Date | null;
  failed_at: Date | null;
  cancelled_at: Date | null;
  last_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class PaymentProcessingError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'AMOUNT_MISMATCH'
      | 'CURRENCY_MISMATCH'
      | 'TRANSACTION_REUSED'
      | 'INVALID_STATE',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentProcessingError';
  }
}

@Injectable()
export class PaymentsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: string, userId?: string): Promise<PaymentView | null> {
    const params: unknown[] = [id];
    const owner = userId ? 'AND o.user_id = $2' : '';
    if (userId) params.push(userId);
    const [row] = await this.dataSource.query<PaymentRow[]>(
      `${this.selectFields} FROM payments p INNER JOIN orders o ON o.id = p.order_id
       WHERE p.id = $1 AND p.deleted_at IS NULL AND o.deleted_at IS NULL ${owner}
       LIMIT 1`,
      params,
    );
    return row ? this.map(row) : null;
  }

  async findLatestForOrder(
    orderId: string,
    userId?: string,
  ): Promise<PaymentView | null> {
    const params: unknown[] = [orderId];
    const owner = userId ? 'AND o.user_id = $2' : '';
    if (userId) params.push(userId);
    const [row] = await this.dataSource.query<PaymentRow[]>(
      `${this.selectFields} FROM payments p INNER JOIN orders o ON o.id = p.order_id
       WHERE p.order_id = $1 AND p.deleted_at IS NULL AND o.deleted_at IS NULL ${owner}
       ORDER BY p.attempt_number DESC, p.created_at DESC LIMIT 1`,
      params,
    );
    return row ? this.map(row) : null;
  }

  async processSepayIpn(payload: SepayIpnPayload): Promise<PaymentView> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const [payment] = (await runner.query(
        `${this.selectFields}, o.status AS order_status, o.stock_restored_at
         FROM payments p INNER JOIN orders o ON o.id = p.order_id
         WHERE p.invoice_number = $1 AND p.provider = 'sepay'
           AND p.deleted_at IS NULL AND o.deleted_at IS NULL
         LIMIT 1 FOR UPDATE OF p, o`,
        [payload.order.invoiceNumber],
      )) as unknown as Array<
        PaymentRow & {
          order_status: OrderStatus;
          stock_restored_at: Date | null;
        }
      >;
      if (!payment) {
        throw new PaymentProcessingError(
          'NOT_FOUND',
          'Không tìm thấy giao dịch thanh toán!',
        );
      }
      this.assertMoney(payment, payload);

      if (
        payload.notificationType === 'ORDER_PAID' &&
        payment.status === PaymentStatus.SUCCESS &&
        payment.transaction_id === payload.transaction.transactionId
      ) {
        await runner.commitTransaction();
        return (await this.findById(payment.id))!;
      }
      if (
        payload.notificationType === 'ORDER_PAID' &&
        payment.status === PaymentStatus.SUCCESS &&
        payment.transaction_id &&
        payment.transaction_id !== payload.transaction.transactionId
      ) {
        throw new PaymentProcessingError(
          'TRANSACTION_REUSED',
          'Thanh toán đã được xác nhận bằng giao dịch khác!',
        );
      }
      if (
        payload.notificationType === 'TRANSACTION_VOID' &&
        (payment.transaction_id !== payload.transaction.transactionId ||
          (payment.status !== PaymentStatus.SUCCESS &&
            payment.status !== PaymentStatus.REVIEW_REQUIRED))
      ) {
        throw new PaymentProcessingError(
          'INVALID_STATE',
          'Giao dịch không ở trạng thái có thể hoàn/hủy!',
        );
      }

      const [reused] = (await runner.query(
        `SELECT id FROM payments WHERE provider = 'sepay' AND transaction_id = $1
         AND id <> $2 AND deleted_at IS NULL LIMIT 1`,
        [payload.transaction.transactionId, payment.id],
      )) as unknown as Array<{ id: string }>;
      if (reused) {
        throw new PaymentProcessingError(
          'TRANSACTION_REUSED',
          'Mã giao dịch SePay đã được sử dụng!',
        );
      }

      await setDatabaseAuditContext(runner, { actorId: null });
      if (payload.notificationType === 'TRANSACTION_VOID') {
        await runner.query(
          `UPDATE payments SET status = 'refunded', metadata = $2::jsonb,
             last_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [payment.id, JSON.stringify(payload.raw)],
        );
      } else {
        const late =
          payment.stock_restored_at !== null ||
          payment.order_status === OrderStatus.CANCELLED ||
          payment.order_status === OrderStatus.REJECTED;
        await runner.query(
          `UPDATE payments
           SET status = $2::payments_status_enum, provider_order_id = $3,
               transaction_id = $4, paid_at = CURRENT_TIMESTAMP,
               last_verified_at = CURRENT_TIMESTAMP, metadata = $5::jsonb,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [
            payment.id,
            late ? PaymentStatus.REVIEW_REQUIRED : PaymentStatus.SUCCESS,
            payload.order.orderId || payload.order.id,
            payload.transaction.transactionId,
            JSON.stringify(payload.raw),
          ],
        );
      }
      await runner.commitTransaction();
      return (await this.findById(payment.id))!;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async expireById(id: string, userId?: string): Promise<PaymentView | null> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const params: unknown[] = [id];
      const owner = userId ? 'AND o.user_id = $2' : '';
      if (userId) params.push(userId);
      const [payment] = (await runner.query(
        `SELECT p.id, p.order_id, p.status, p.expires_at, o.user_id, o.order_code,
                o.status AS order_status, o.stock_restored_at
         FROM payments p INNER JOIN orders o ON o.id = p.order_id
         WHERE p.id = $1 AND p.deleted_at IS NULL AND o.deleted_at IS NULL ${owner}
         LIMIT 1 FOR UPDATE OF p, o`,
        params,
      )) as unknown as Array<{
        id: string;
        order_id: string;
        status: PaymentStatus;
        expires_at: Date | null;
        user_id: string;
        order_code: string;
        order_status: OrderStatus;
        stock_restored_at: Date | null;
      }>;
      if (!payment) {
        await runner.rollbackTransaction();
        return null;
      }
      if (
        payment.status !== PaymentStatus.PENDING ||
        !payment.expires_at ||
        new Date(payment.expires_at).getTime() > Date.now()
      ) {
        await runner.commitTransaction();
        return this.findById(id, userId);
      }
      await this.cancelAndRelease(
        runner,
        payment,
        PaymentStatus.EXPIRED,
        'Thanh toán SePay đã hết hạn',
      );
      await runner.commitTransaction();
      return this.findById(id, userId);
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async cancelPending(id: string, userId: string): Promise<PaymentView | null> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const [payment] = (await runner.query(
        `SELECT p.id, p.order_id, p.status, p.expires_at, o.user_id, o.order_code,
                o.status AS order_status, o.stock_restored_at
         FROM payments p INNER JOIN orders o ON o.id = p.order_id
         WHERE p.id = $1 AND o.user_id = $2 AND p.deleted_at IS NULL
           AND p.provider = 'sepay' AND o.deleted_at IS NULL
         LIMIT 1 FOR UPDATE OF p, o`,
        [id, userId],
      )) as unknown as Array<{
        id: string;
        order_id: string;
        status: PaymentStatus;
        expires_at: Date | null;
        user_id: string;
        order_code: string;
        order_status: OrderStatus;
        stock_restored_at: Date | null;
      }>;
      if (!payment) {
        await runner.rollbackTransaction();
        return null;
      }
      if (payment.status === PaymentStatus.PENDING) {
        await this.cancelAndRelease(
          runner,
          payment,
          PaymentStatus.CANCELLED,
          'Khách hàng hủy thanh toán SePay',
        );
      }
      await runner.commitTransaction();
      return this.findById(id, userId);
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async expireDue(limit: number): Promise<number> {
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM payments WHERE provider = 'sepay' AND status = 'pending'
       AND expires_at <= CURRENT_TIMESTAMP AND deleted_at IS NULL
       ORDER BY expires_at ASC LIMIT $1`,
      [limit],
    );
    let count = 0;
    for (const row of rows) {
      const expired = await this.expireById(row.id);
      if (expired?.status === PaymentStatus.EXPIRED) count++;
    }
    return count;
  }

  private async cancelAndRelease(
    runner: QueryRunner,
    payment: {
      id: string;
      order_id: string;
      user_id: string;
      order_code: string;
      order_status: OrderStatus;
      stock_restored_at: Date | null;
    },
    status: PaymentStatus.EXPIRED | PaymentStatus.CANCELLED,
    reason: string,
  ): Promise<void> {
    await setDatabaseAuditContext(runner, {
      actorId: payment.user_id,
      inventoryReason: `${reason}: ${payment.order_code}`,
      inventoryType: 'order_restock',
    });
    await runner.query(
      `UPDATE payments SET status = $2::payments_status_enum,
         cancelled_at = CASE
           WHEN $2::payments_status_enum = 'cancelled'::payments_status_enum
             THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
         failed_at = CASE
           WHEN $2::payments_status_enum = 'expired'::payments_status_enum
             THEN CURRENT_TIMESTAMP ELSE failed_at END,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'`,
      [payment.id, status],
    );
    if (
      payment.order_status !== OrderStatus.PENDING ||
      payment.stock_restored_at !== null
    )
      return;
    const updated: unknown = await runner.query(
      `UPDATE orders SET status = 'cancelled', cancellation_reason = $2,
         cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $3,
         stock_restored_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending' AND stock_restored_at IS NULL
       RETURNING id`,
      [payment.order_id, reason, payment.user_id],
    );
    if (!extractPostgresRows<{ id: string }>(updated).length) return;
    await this.restockOrder(runner, payment.order_id);
    const redemptions = (await runner.query(
      `DELETE FROM voucher_redemptions WHERE order_id = $1 RETURNING voucher_id`,
      [payment.order_id],
    )) as unknown as Array<{ voucher_id: string }>;
    for (const redemption of redemptions) {
      await runner.query(
        `UPDATE vouchers SET used_count = GREATEST(used_count - 1, 0),
           updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [redemption.voucher_id],
      );
    }
  }

  private async restockOrder(runner: QueryRunner, orderId: string) {
    const items = (await runner.query(
      `SELECT product_id, variant_id, quantity FROM order_items
       WHERE order_id = $1 AND deleted_at IS NULL
       ORDER BY product_id ASC, variant_id ASC NULLS FIRST FOR UPDATE`,
      [orderId],
    )) as unknown as Array<{
      product_id: string | null;
      variant_id: string | null;
      quantity: number;
    }>;
    for (const item of items) {
      if (!item.product_id) continue;
      await runner.query(
        `UPDATE inventories SET stock = stock + $2, updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $1 AND deleted_at IS NULL`,
        [item.product_id, item.quantity],
      );
      if (item.variant_id) {
        await runner.query(
          `UPDATE product_variants SET stock = stock + $2,
             updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`,
          [item.variant_id, item.quantity],
        );
      }
    }
  }

  private assertMoney(payment: PaymentRow, payload: SepayIpnPayload) {
    const localAmount = this.vnd(payment.amount);
    const orderAmount = this.vnd(payload.order.amount);
    const transactionAmount = this.vnd(payload.transaction.amount);
    if (localAmount !== orderAmount || localAmount !== transactionAmount) {
      throw new PaymentProcessingError(
        'AMOUNT_MISMATCH',
        'Số tiền thanh toán không khớp đơn hàng!',
      );
    }
    if (
      payment.currency !== 'VND' ||
      payload.order.currency !== 'VND' ||
      payload.transaction.currency !== 'VND'
    ) {
      throw new PaymentProcessingError(
        'CURRENCY_MISMATCH',
        'Đơn vị tiền tệ thanh toán không hợp lệ!',
      );
    }
  }

  private vnd(value: string | number): number {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || !Number.isInteger(normalized))
      return Number.NaN;
    return normalized;
  }

  private readonly selectFields = `SELECT p.id, p.order_id, p.amount, p.status,
    p.provider, p.method, p.invoice_number, p.provider_order_id,
    p.transaction_id, p.currency, p.attempt_number, p.expires_at, p.paid_at,
    p.failed_at, p.cancelled_at, p.last_verified_at, p.created_at, p.updated_at`;

  private map(row: PaymentRow): PaymentView {
    return {
      id: row.id,
      orderId: row.order_id,
      amount: Number(row.amount),
      status: row.status,
      provider: row.provider,
      method: row.method,
      invoiceNumber: row.invoice_number,
      providerOrderId: row.provider_order_id,
      transactionId: row.transaction_id,
      currency: row.currency,
      attemptNumber: row.attempt_number,
      expiresAt: row.expires_at,
      paidAt: row.paid_at,
      failedAt: row.failed_at,
      cancelledAt: row.cancelled_at,
      lastVerifiedAt: row.last_verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
