import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { extractPostgresRows } from '@common/database/postgres-query-result';
import { OrderReturnEvidence, OrderStatus } from '@entities';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import {
  VoucherPreviewDto,
  VoucherPreviewMode,
} from './dto/voucher-preview.dto';

export type OrderCreationErrorCode =
  | 'CART_EMPTY'
  | 'PRODUCT_REFERENCE_REQUIRED'
  | 'PRODUCT_UNAVAILABLE'
  | 'VARIANT_REQUIRED'
  | 'VARIANT_INVALID'
  | 'INVENTORY_MISSING'
  | 'STOCK_EXCEEDED'
  | 'VOUCHER_INVALID'
  | 'IDEMPOTENCY_KEY_REUSED';

export class OrderCreationError extends Error {
  constructor(
    public readonly code: OrderCreationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OrderCreationError';
  }
}

export interface OrderRecipientInput {
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  note?: string;
}

export interface BuyNowInput {
  productId?: string;
  productSku?: string;
  variantId?: string;
  variantSku?: string;
  quantity: number;
}

export interface OrderIdempotencyInput {
  key: string;
  fingerprint: string;
}

export interface OrderItemView {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  variantValue: string | null;
  variantSku: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface OrderView {
  id: string;
  orderCode: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  voucherId: string | null;
  voucherCode: string | null;
  shippingAddress: string;
  recipientName: string;
  recipientPhone: string;
  note: string | null;
  rejectionReason: string | null;
  rejectedAt: Date | null;
  confirmedAt: Date | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  returnReason: string | null;
  returnEvidence: OrderReturnEvidence[];
  returnRequestedAt: Date | null;
  returnReviewReason: string | null;
  returnReviewedAt: Date | null;
  returnReviewedBy: string | null;
  stockRestoredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  items: OrderItemView[];
}

export interface OrderSummaryView extends Omit<OrderView, 'items'> {
  itemCount: number;
}

export interface VoucherPreviewView {
  code: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
}

interface RequestedLine {
  productId?: string;
  productSku?: string;
  variantId?: string | null;
  variantSku?: string;
  quantity: number;
}

interface RawCartLine {
  product_id: string;
  variant_id: string | null;
  quantity: number;
}

interface RawProduct {
  id: string;
  name: string;
  sku: string | null;
  unit_price: number | string;
  category_id: string | null;
}

interface RawVariant {
  id: string;
  product_id: string;
  parent_id: string | null;
  name: string;
  value: string;
  sku: string | null;
  unit_price: number | string | null;
  stock: number;
}

interface RawInventory {
  id: string;
  stock: number;
  reserved_stock: number;
}

interface RawOrder {
  id: string;
  order_code: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number | string;
  subtotal_amount: number | string;
  discount_amount: number | string;
  voucher_id: string | null;
  voucher_code: string | null;
  shipping_address: string;
  recipient_name: string;
  recipient_phone: string;
  note: string | null;
  rejection_reason: string | null;
  rejected_at: Date | null;
  confirmed_at: Date | null;
  cancellation_reason: string | null;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  return_reason: string | null;
  return_evidence: OrderReturnEvidence[] | null;
  return_requested_at: Date | null;
  return_review_reason: string | null;
  return_reviewed_at: Date | null;
  return_reviewed_by: string | null;
  stock_restored_at: Date | null;
  created_at: Date;
  updated_at: Date;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  item_count?: number | string;
}

interface RawOrderItem {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  variant_value: string | null;
  variant_sku: string | null;
  unit_price: number | string;
  quantity: number;
  subtotal: number | string;
}

interface CountRow {
  count: number | string;
}

interface LockedVoucher {
  id: string;
  code: string;
  status: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number | string;
  max_discount_amount: number | string | null;
  minimum_order_amount: number | string;
  scope: 'shop' | 'products' | 'categories';
  audience:
    | 'all'
    | 'new_customers'
    | 'existing_customers'
    | 'member_groups'
    | 'specific_customers';
  issued_quantity: number | null;
  max_usage_count: number | null;
  usage_limit_per_user: number;
  used_count: number;
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly dataSource: DataSource) {}

  async previewVoucher(
    userId: string,
    dto: VoucherPreviewDto,
  ): Promise<VoucherPreviewView> {
    const lines =
      dto.mode === VoucherPreviewMode.CART
        ? await this.dataSource.query<
            Array<{
              product_id: string;
              category_id: string | null;
              subtotal: string | number;
            }>
          >(
            `SELECT p.id AS product_id, p.category_id,
                  (COALESCE(pv.unit_price, p.unit_price) * ci.quantity) AS subtotal
           FROM carts c INNER JOIN cart_items ci ON ci.cart_id = c.id AND ci.deleted_at IS NULL
           INNER JOIN products p ON p.id = ci.product_id AND p.deleted_at IS NULL AND p.is_active = TRUE
           LEFT JOIN product_variants pv ON pv.id = ci.variant_id AND pv.deleted_at IS NULL AND pv.is_active = TRUE
           WHERE c.user_id = $1 AND c.deleted_at IS NULL`,
            [userId],
          )
        : await this.previewBuyNowLines(dto);
    if (!lines.length)
      throw new OrderCreationError(
        'CART_EMPTY',
        'Không có sản phẩm để áp dụng voucher!',
      );
    const subtotal = lines.reduce(
      (sum, line) => sum + Number(line.subtotal),
      0,
    );
    const [voucher] = await this.dataSource.query<LockedVoucher[]>(
      `SELECT id, code, status, discount_type, discount_value, max_discount_amount,
              minimum_order_amount, scope, audience, issued_quantity, max_usage_count,
              usage_limit_per_user, used_count
       FROM vouchers WHERE UPPER(code) = UPPER($1) AND deleted_at IS NULL LIMIT 1`,
      [dto.code],
    );
    const invalid = (message: string): never => {
      throw new OrderCreationError('VOUCHER_INVALID', message);
    };
    if (!voucher) invalid('Mã voucher không tồn tại!');
    const [validity] = await this.dataSource.query<Array<{ valid: boolean }>>(
      `SELECT (status = 'active' AND start_at <= CURRENT_TIMESTAMP AND end_at > CURRENT_TIMESTAMP) AS valid FROM vouchers WHERE id = $1`,
      [voucher.id],
    );
    if (!validity?.valid)
      invalid('Voucher chưa có hiệu lực, đã hết hạn hoặc đã bị tắt!');
    const limit = Math.min(
      voucher.issued_quantity ?? Number.MAX_SAFE_INTEGER,
      voucher.max_usage_count ?? Number.MAX_SAFE_INTEGER,
    );
    if (voucher.used_count >= limit) invalid('Voucher đã hết lượt sử dụng!');
    const [usage] = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*) AS count FROM voucher_redemptions WHERE voucher_id = $1 AND user_id = $2`,
      [voucher.id, userId],
    );
    if (Number(usage?.count ?? 0) >= voucher.usage_limit_per_user)
      invalid('Bạn đã dùng hết số lượt cho voucher này!');
    await this.assertPreviewAudience(voucher, userId, invalid);
    if (subtotal < Number(voucher.minimum_order_amount))
      invalid('Đơn hàng chưa đạt giá trị tối thiểu của voucher!');
    let eligibleAmount = subtotal;
    if (voucher.scope !== 'shop') {
      const allowed =
        voucher.scope === 'products'
          ? await this.dataSource.query<Array<{ id: string }>>(
              `SELECT product_id AS id FROM voucher_products WHERE voucher_id = $1`,
              [voucher.id],
            )
          : await this.dataSource.query<Array<{ id: string }>>(
              `SELECT category_id AS id FROM voucher_categories WHERE voucher_id = $1`,
              [voucher.id],
            );
      const ids = new Set(allowed.map((row) => row.id));
      eligibleAmount = lines
        .filter((line) =>
          ids.has(
            voucher.scope === 'products'
              ? line.product_id
              : (line.category_id ?? ''),
          ),
        )
        .reduce((sum, line) => sum + Number(line.subtotal), 0);
      if (eligibleAmount <= 0)
        invalid('Voucher không áp dụng cho sản phẩm trong đơn hàng!');
    }
    let discount =
      voucher.discount_type === 'percentage'
        ? (eligibleAmount * Number(voucher.discount_value)) / 100
        : Number(voucher.discount_value);
    if (voucher.max_discount_amount != null)
      discount = Math.min(discount, Number(voucher.max_discount_amount));
    discount = Math.min(
      Math.round(discount * 100) / 100,
      eligibleAmount,
      subtotal,
    );
    return {
      code: voucher.code,
      subtotalAmount: subtotal,
      discountAmount: discount,
      totalAmount: subtotal - discount,
    };
  }

  private async previewBuyNowLines(dto: VoucherPreviewDto) {
    if ((!dto.productId && !dto.productSku) || !dto.quantity)
      throw new OrderCreationError(
        'PRODUCT_REFERENCE_REQUIRED',
        'Thiếu thông tin sản phẩm mua ngay!',
      );
    const rows = await this.dataSource.query<
      Array<{
        product_id: string;
        category_id: string | null;
        subtotal: string | number;
      }>
    >(
      `SELECT p.id AS product_id, p.category_id,
              (COALESCE(pv.unit_price, p.unit_price) * $3::integer) AS subtotal
       FROM products p
       LEFT JOIN product_variants pv ON ($2::text IS NOT NULL) AND
         (pv.id::text = $2 OR LOWER(pv.sku) = LOWER($2)) AND pv.product_id = p.id
         AND pv.deleted_at IS NULL AND pv.is_active = TRUE
       WHERE (p.id::text = $1 OR LOWER(p.sku) = LOWER($1))
         AND p.deleted_at IS NULL AND p.is_active = TRUE LIMIT 1`,
      [
        dto.productId ?? dto.productSku,
        dto.variantId ?? dto.variantSku ?? null,
        dto.quantity,
      ],
    );
    if (!rows.length)
      throw new OrderCreationError(
        'PRODUCT_UNAVAILABLE',
        'Sản phẩm hoặc biến thể không còn khả dụng!',
      );
    return rows;
  }

  private async assertPreviewAudience(
    voucher: LockedVoucher,
    userId: string,
    invalid: (message: string) => never,
  ): Promise<void> {
    if (voucher.audience === 'all') return;
    if (voucher.audience === 'specific_customers') {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM voucher_customers WHERE voucher_id = $1 AND user_id = $2`,
        [voucher.id, userId],
      );
      if (!rows.length) invalid('Voucher không dành cho tài khoản này!');
      return;
    }
    if (voucher.audience === 'member_groups') {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM voucher_customer_groups vcg INNER JOIN customer_group_members cgm ON cgm.group_id = vcg.group_id WHERE vcg.voucher_id = $1 AND cgm.user_id = $2 LIMIT 1`,
        [voucher.id, userId],
      );
      if (!rows.length)
        invalid('Tài khoản không thuộc nhóm thành viên được áp dụng!');
      return;
    }
    const [history] = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*) AS count FROM orders WHERE user_id = $1 AND deleted_at IS NULL AND status NOT IN ('cancelled','rejected')`,
      [userId],
    );
    const hasOrder = Number(history?.count ?? 0) > 0;
    if (voucher.audience === 'new_customers' && hasOrder)
      invalid('Voucher chỉ dành cho khách hàng mới!');
    if (voucher.audience === 'existing_customers' && !hasOrder)
      invalid('Voucher chỉ dành cho khách hàng cũ!');
  }

  async findAll(
    query: OrderQueryDto,
    userId?: string,
  ): Promise<PaginatedData<OrderSummaryView>> {
    const conditions = ['o.deleted_at IS NULL'];
    const parameters: unknown[] = [];
    const addParameter = (value: unknown): string => {
      parameters.push(value);
      return `$${parameters.length}`;
    };
    if (userId) conditions.push(`o.user_id = ${addParameter(userId)}`);
    if (query.status)
      conditions.push(`o.status = ${addParameter(query.status)}`);
    if (query.search) {
      const value = addParameter(`%${query.search}%`);
      conditions.push(`(
        o.order_code ILIKE ${value}
        OR o.recipient_name ILIKE ${value}
        OR o.recipient_phone ILIKE ${value}
        OR u.email ILIKE ${value}
      )`);
    }

    const where = conditions.join(' AND ');
    const [{ count = 0 } = {}] = (await this.dataSource.query(
      `SELECT COUNT(*) AS count
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE ${where}`,
      parameters,
    )) as unknown as CountRow[];
    const totalItems = Number(count);
    const sortColumns: Record<string, string> = {
      createdAt: 'o.created_at',
      updatedAt: 'o.updated_at',
      orderCode: 'o.order_code',
      totalAmount: 'o.total_amount',
      status: 'o.status',
    };
    const sortColumn = sortColumns[query.sortBy] ?? sortColumns.createdAt;
    const limitParameter = addParameter(query.limit);
    const offsetParameter = addParameter(query.skip);
    const rows = (await this.dataSource.query(
      `SELECT o.id, o.order_code, o.user_id, o.status, o.total_amount,
              o.subtotal_amount, o.discount_amount, o.voucher_id, o.voucher_code,
              o.shipping_address, o.recipient_name, o.recipient_phone, o.note,
              o.rejection_reason, o.rejected_at, o.confirmed_at,
              o.cancellation_reason, o.cancelled_at, o.cancelled_by,
              o.return_reason, o.return_evidence, o.return_requested_at,
              o.return_review_reason, o.return_reviewed_at,
              o.return_reviewed_by, o.stock_restored_at,
              o.created_at, o.updated_at,
              u.full_name AS customer_name, u.email AS customer_email,
              u.phone AS customer_phone,
              (SELECT COUNT(*) FROM order_items oi
               WHERE oi.order_id = o.id AND oi.deleted_at IS NULL) AS item_count
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE ${where}
       ORDER BY ${sortColumn} ${query.sortOrder}
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      parameters,
    )) as unknown as RawOrder[];
    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);
    return {
      items: rows.map((row) => ({
        ...this.mapOrder(row, []),
        itemCount: Number(row.item_count ?? 0),
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async findById(id: string, userId?: string): Promise<OrderView | null> {
    const parameters: unknown[] = [id];
    const ownerCondition = userId ? `AND o.user_id = $2` : '';
    if (userId) parameters.push(userId);
    const rows = (await this.dataSource.query(
      `SELECT o.id, o.order_code, o.user_id, o.status, o.total_amount,
              o.subtotal_amount, o.discount_amount, o.voucher_id, o.voucher_code,
              o.shipping_address, o.recipient_name, o.recipient_phone, o.note,
              o.rejection_reason, o.rejected_at, o.confirmed_at,
              o.cancellation_reason, o.cancelled_at, o.cancelled_by,
              o.return_reason, o.return_evidence, o.return_requested_at,
              o.return_review_reason, o.return_reviewed_at,
              o.return_reviewed_by, o.stock_restored_at,
              o.created_at, o.updated_at,
              u.full_name AS customer_name, u.email AS customer_email,
              u.phone AS customer_phone
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = $1 AND o.deleted_at IS NULL ${ownerCondition}
       LIMIT 1`,
      parameters,
    )) as unknown as RawOrder[];
    const order = rows[0];
    if (!order) return null;
    const items = (await this.dataSource.query(
      `SELECT id, product_id, variant_id, product_name, variant_name,
              variant_value, variant_sku, unit_price, quantity, subtotal
       FROM order_items
       WHERE order_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [id],
    )) as unknown as RawOrderItem[];
    return this.mapOrder(
      order,
      items.map((item) => this.mapOrderItem(item)),
    );
  }

  async findStatus(id: string): Promise<OrderStatus | null> {
    const [row] = (await this.dataSource.query(
      `SELECT status FROM orders WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    )) as unknown as { status: OrderStatus }[];
    return row?.status ?? null;
  }

  async updateStatus(
    id: string,
    expectedStatus: OrderStatus,
    nextStatus: OrderStatus,
    actorId?: string,
  ): Promise<OrderView | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId });
      const result: unknown = await queryRunner.query(
        `UPDATE orders
       SET status = $3,
           confirmed_at = CASE
             WHEN $3 = 'confirmed' THEN CURRENT_TIMESTAMP
             ELSE confirmed_at
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = $2 AND deleted_at IS NULL
       RETURNING id`,
        [id, expectedStatus, nextStatus],
      );
      const rows = extractPostgresRows<{ id: string }>(result);
      await queryRunner.commitTransaction();
      return rows[0] ? this.findById(id) : null;
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async reject(
    id: string,
    reason: string,
    actorId: string,
  ): Promise<OrderView | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId });
      const updateResult: unknown = await queryRunner.query(
        `UPDATE orders
         SET status = $2, rejection_reason = $3, rejected_at = CURRENT_TIMESTAMP,
             stock_restored_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = $4 AND stock_restored_at IS NULL
           AND deleted_at IS NULL
         RETURNING order_code`,
        [id, OrderStatus.REJECTED, reason, OrderStatus.PENDING],
      );
      const updatedRows = extractPostgresRows<{ order_code: string }>(
        updateResult,
      );
      const updated = updatedRows[0];
      if (!updated) {
        await queryRunner.rollbackTransaction();
        return null;
      }
      await this.restockOrder(
        queryRunner,
        id,
        actorId,
        `Từ chối đơn ${updated.order_code}: ${reason}`,
      );
      await queryRunner.commitTransaction();
      return this.findById(id);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelByCustomer(
    id: string,
    userId: string,
    reason: string,
  ): Promise<OrderView | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId: userId });
      const result: unknown = await queryRunner.query(
        `UPDATE orders
         SET status = $3, cancellation_reason = $4,
             cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $2,
             stock_restored_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2
           AND status IN ($5, $6)
           AND stock_restored_at IS NULL AND deleted_at IS NULL
         RETURNING order_code`,
        [
          id,
          userId,
          OrderStatus.CANCELLED,
          reason,
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
        ],
      );
      const [updated] = extractPostgresRows<{ order_code: string }>(result);
      if (!updated) {
        await queryRunner.rollbackTransaction();
        return null;
      }
      await this.restockOrder(
        queryRunner,
        id,
        userId,
        `Khách hàng hủy đơn ${updated.order_code}: ${reason}`,
      );
      await queryRunner.commitTransaction();
      return this.findById(id, userId);
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async requestReturn(
    id: string,
    userId: string,
    reason: string,
    evidence: OrderReturnEvidence[],
  ): Promise<OrderView | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId: userId });
      const result: unknown = await queryRunner.query(
        `UPDATE orders
         SET status = $3, return_reason = $4, return_evidence = $5::jsonb,
             return_requested_at = CURRENT_TIMESTAMP,
             return_review_reason = NULL, return_reviewed_at = NULL,
             return_reviewed_by = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND status = $6
           AND confirmed_at IS NOT NULL
           AND CURRENT_TIMESTAMP <= confirmed_at + INTERVAL '7 days'
           AND deleted_at IS NULL
         RETURNING id`,
        [
          id,
          userId,
          OrderStatus.RETURN_REQUESTED,
          reason,
          JSON.stringify(evidence),
          OrderStatus.COMPLETED,
        ],
      );
      const [updated] = extractPostgresRows<{ id: string }>(result);
      if (!updated) {
        await queryRunner.rollbackTransaction();
        return null;
      }
      await queryRunner.commitTransaction();
      return this.findById(id, userId);
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async reviewReturn(
    id: string,
    approved: boolean,
    reason: string,
    actorId: string,
  ): Promise<OrderView | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId });
      const nextStatus = approved
        ? OrderStatus.RETURNED
        : OrderStatus.RETURN_REJECTED;
      const result: unknown = await queryRunner.query(
        `UPDATE orders
         SET status = $2, return_review_reason = $3,
             return_reviewed_at = CURRENT_TIMESTAMP, return_reviewed_by = $4,
             stock_restored_at = CASE
               WHEN $5::boolean THEN CURRENT_TIMESTAMP ELSE stock_restored_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = $6
           AND ($5::boolean = FALSE OR stock_restored_at IS NULL)
           AND deleted_at IS NULL
         RETURNING order_code`,
        [
          id,
          nextStatus,
          reason,
          actorId,
          approved,
          OrderStatus.RETURN_REQUESTED,
        ],
      );
      const [updated] = extractPostgresRows<{ order_code: string }>(result);
      if (!updated) {
        await queryRunner.rollbackTransaction();
        return null;
      }
      if (approved) {
        await this.restockOrder(
          queryRunner,
          id,
          actorId,
          `Hoàn trả đơn ${updated.order_code}: ${reason}`,
        );
      }
      await queryRunner.commitTransaction();
      return this.findById(id);
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  createFromCart(
    userId: string,
    recipient: OrderRecipientInput,
    idempotency: OrderIdempotencyInput,
    voucherCode?: string,
  ): Promise<OrderView> {
    return this.createOrder(
      userId,
      recipient,
      async (queryRunner) => {
        const rows = (await queryRunner.query(
          `SELECT ci.product_id, ci.variant_id, ci.quantity
         FROM carts cart
         INNER JOIN cart_items ci
           ON ci.cart_id = cart.id AND ci.deleted_at IS NULL
         WHERE cart.user_id = $1
           AND cart.deleted_at IS NULL
         ORDER BY ci.created_at ASC
         FOR UPDATE OF cart, ci`,
          [userId],
        )) as unknown as RawCartLine[];
        if (rows.length === 0) {
          throw new OrderCreationError('CART_EMPTY', 'Giỏ hàng đang trống!');
        }
        return rows.map((row) => ({
          productId: row.product_id,
          variantId: row.variant_id,
          quantity: row.quantity,
        }));
      },
      true,
      idempotency,
      voucherCode,
    );
  }

  createBuyNow(
    userId: string,
    recipient: OrderRecipientInput,
    item: BuyNowInput,
    idempotency: OrderIdempotencyInput,
    voucherCode?: string,
  ): Promise<OrderView> {
    return this.createOrder(
      userId,
      recipient,
      () => Promise.resolve([item]),
      false,
      idempotency,
      voucherCode,
    );
  }

  private async createOrder(
    userId: string,
    recipient: OrderRecipientInput,
    loadLines: (queryRunner: QueryRunner) => Promise<RequestedLine[]>,
    clearCart: boolean,
    idempotency: OrderIdempotencyInput,
    voucherCode?: string,
  ): Promise<OrderView> {
    const existing = await this.findByIdempotencyKey(userId, idempotency);
    if (existing) return existing;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.createOrderAttempt(
          userId,
          recipient,
          loadLines,
          clearCart,
          idempotency,
          voucherCode,
        );
      } catch (error) {
        if (!this.isRetryableTransactionError(error) || attempt === 3) {
          throw error;
        }
      }
    }
    throw new Error('Không thể tạo đơn hàng sau khi thử lại');
  }

  private async createOrderAttempt(
    userId: string,
    recipient: OrderRecipientInput,
    loadLines: (queryRunner: QueryRunner) => Promise<RequestedLine[]>,
    clearCart: boolean,
    idempotency: OrderIdempotencyInput,
    voucherCode?: string,
  ): Promise<OrderView> {
    const queryRunner = this.dataSource.createQueryRunner();
    let released = false;
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId: userId });
      const order = await this.insertOrder(
        queryRunner,
        userId,
        recipient,
        idempotency,
      );
      const lines = (await loadLines(queryRunner)).sort((left, right) =>
        this.lineLockKey(left).localeCompare(this.lineLockKey(right)),
      );
      const items: OrderItemView[] = [];
      let totalAmount = 0;

      for (const line of lines) {
        const item = await this.reserveLine(queryRunner, line, order);
        items.push(item);
        totalAmount += item.subtotal;
      }

      const voucher = voucherCode
        ? await this.redeemVoucher(
            queryRunner,
            voucherCode,
            userId,
            order.id,
            items,
            totalAmount,
          )
        : null;
      const discountAmount = voucher?.discountAmount ?? 0;
      const payableAmount = Math.max(totalAmount - discountAmount, 0);

      await queryRunner.query(
        `UPDATE orders
         SET subtotal_amount = $2, discount_amount = $3, total_amount = $4,
             voucher_id = $5, voucher_code = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          order.id,
          totalAmount,
          discountAmount,
          payableAmount,
          voucher?.voucherId ?? null,
          voucher?.voucherCode ?? null,
        ],
      );
      if (clearCart) {
        await queryRunner.query(
          `DELETE FROM cart_items
           WHERE cart_id IN (
             SELECT id FROM carts
             WHERE user_id = $1 AND deleted_at IS NULL
           )`,
          [userId],
        );
      }

      await queryRunner.commitTransaction();
      return {
        id: order.id,
        orderCode: order.order_code,
        userId: order.user_id,
        status: order.status,
        totalAmount: payableAmount,
        subtotalAmount: totalAmount,
        discountAmount,
        voucherId: voucher?.voucherId ?? null,
        voucherCode: voucher?.voucherCode ?? null,
        shippingAddress: order.shipping_address,
        recipientName: order.recipient_name,
        recipientPhone: order.recipient_phone,
        note: order.note,
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
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
      released = true;
      if (this.isUniqueViolation(error)) {
        const existing = await this.findByIdempotencyKey(userId, idempotency);
        if (existing) return existing;
      }
      throw error;
    } finally {
      if (!released) await queryRunner.release();
    }
  }

  private async insertOrder(
    queryRunner: QueryRunner,
    userId: string,
    recipient: OrderRecipientInput,
    idempotency: OrderIdempotencyInput,
  ): Promise<RawOrder> {
    const orderCode = this.generateOrderCode();
    const rows = (await queryRunner.query(
      `INSERT INTO orders
         (order_code, user_id, status, total_amount, shipping_address,
          recipient_name, recipient_phone, note, idempotency_key,
          request_fingerprint)
       VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9)
       RETURNING id, order_code, user_id, status, total_amount,
                 shipping_address, recipient_name, recipient_phone, note,
                 created_at, updated_at`,
      [
        orderCode,
        userId,
        OrderStatus.PENDING,
        recipient.shippingAddress,
        recipient.recipientName,
        recipient.recipientPhone,
        recipient.note ?? null,
        idempotency.key,
        idempotency.fingerprint,
      ],
    )) as unknown as RawOrder[];
    const order = rows[0];
    if (!order) throw new Error('Không thể tạo đơn hàng');
    return order;
  }

  private async reserveLine(
    queryRunner: QueryRunner,
    line: RequestedLine,
    order: RawOrder,
  ): Promise<OrderItemView> {
    if (!line.productId && !line.productSku?.trim()) {
      throw new OrderCreationError(
        'PRODUCT_REFERENCE_REQUIRED',
        'Cần cung cấp productId hoặc productSku!',
      );
    }
    const product = await this.lockProduct(queryRunner, line);
    const activeVariantCount = await this.countActiveVariants(
      queryRunner,
      product.id,
    );
    const variant =
      line.variantId || line.variantSku
        ? await this.lockVariant(queryRunner, line)
        : null;

    if (activeVariantCount > 0 && !variant) {
      throw new OrderCreationError(
        'VARIANT_REQUIRED',
        `Vui lòng chọn biến thể cho sản phẩm “${product.name}”!`,
      );
    }
    if (variant) {
      await this.validateVariant(queryRunner, product, variant);
    }

    const inventory = await this.lockInventory(queryRunner, product.id);
    const availableStock = Math.max(
      inventory.stock - inventory.reserved_stock,
      0,
    );
    if (
      availableStock < line.quantity ||
      (variant && variant.stock < line.quantity)
    ) {
      throw new OrderCreationError(
        'STOCK_EXCEEDED',
        `Sản phẩm “${product.name}” không đủ tồn kho!`,
      );
    }

    if (variant) {
      await setDatabaseAuditContext(queryRunner, {
        actorId: order.user_id,
        inventoryReason: `Đặt đơn ${order.order_code}`,
        inventoryType: 'order_reserve',
      });
      await queryRunner.query(
        `UPDATE product_variants
         SET stock = stock - $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [variant.id, line.quantity],
      );
    }
    if (!variant) {
      await setDatabaseAuditContext(queryRunner, {
        actorId: order.user_id,
        inventoryReason: `Đặt đơn ${order.order_code}`,
        inventoryType: 'order_reserve',
      });
    }
    const newStock = inventory.stock - line.quantity;
    await queryRunner.query(
      `UPDATE inventories
       SET stock = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [inventory.id, newStock],
    );
    const unitPrice = Number(variant?.unit_price ?? product.unit_price);
    const subtotal = unitPrice * line.quantity;
    const rows = (await queryRunner.query(
      `INSERT INTO order_items
         (order_id, product_id, variant_id, product_name, variant_name,
          variant_value, variant_sku, unit_price, quantity, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, product_id, variant_id, product_name, variant_name,
                 variant_value, variant_sku, unit_price, quantity, subtotal`,
      [
        order.id,
        product.id,
        variant?.id ?? null,
        product.name,
        variant?.name ?? null,
        variant?.value ?? null,
        variant?.sku ?? null,
        unitPrice,
        line.quantity,
        subtotal,
      ],
    )) as unknown as RawOrderItem[];
    const item = rows[0];
    if (!item) throw new Error('Không thể tạo chi tiết đơn hàng');
    return this.mapOrderItem(item);
  }

  private async lockProduct(
    queryRunner: QueryRunner,
    line: RequestedLine,
  ): Promise<RawProduct> {
    const rows = (await queryRunner.query(
      `SELECT p.id, p.name, p.sku, p.unit_price, p.category_id
       FROM products p
       WHERE ${line.productId ? 'p.id = $1' : 'LOWER(p.sku) = LOWER($1)'}
         AND p.is_active = TRUE
         AND p.deleted_at IS NULL
         AND (
           p.category_id IS NULL OR EXISTS(
             SELECT 1 FROM categories c
             WHERE c.id = p.category_id
               AND c.is_active = TRUE
               AND c.deleted_at IS NULL
           )
         )
       LIMIT 1
       FOR UPDATE OF p`,
      [line.productId ?? line.productSku?.trim()],
    )) as unknown as RawProduct[];
    const product = rows[0];
    if (!product) {
      throw new OrderCreationError(
        'PRODUCT_UNAVAILABLE',
        'Sản phẩm không tồn tại, đã bị ẩn hoặc danh mục ngừng hoạt động!',
      );
    }
    return product;
  }

  private async lockVariant(
    queryRunner: QueryRunner,
    line: RequestedLine,
  ): Promise<RawVariant> {
    const rows = (await queryRunner.query(
      `SELECT id, product_id, parent_id, name, value, sku, unit_price, stock
       FROM product_variants
       WHERE ${line.variantId ? 'id = $1' : 'LOWER(sku) = LOWER($1)'}
         AND is_active = TRUE
         AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [line.variantId ?? line.variantSku?.trim()],
    )) as unknown as RawVariant[];
    const variant = rows[0];
    if (!variant) {
      throw new OrderCreationError(
        'VARIANT_INVALID',
        'Biến thể không tồn tại hoặc đã bị ẩn!',
      );
    }
    return variant;
  }

  private async validateVariant(
    queryRunner: QueryRunner,
    product: RawProduct,
    variant: RawVariant,
  ): Promise<void> {
    if (variant.product_id !== product.id) {
      throw new OrderCreationError(
        'VARIANT_INVALID',
        'Biến thể không thuộc sản phẩm đã chọn!',
      );
    }
    const [row] = (await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM product_variants
       WHERE parent_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [variant.id],
    )) as unknown as CountRow[];
    if (Number(row?.count ?? 0) > 0) {
      throw new OrderCreationError(
        'VARIANT_INVALID',
        'Chỉ được mua biến thể cuối của sản phẩm!',
      );
    }
  }

  private async lockInventory(
    queryRunner: QueryRunner,
    productId: string,
  ): Promise<RawInventory> {
    const rows = (await queryRunner.query(
      `SELECT id, stock, reserved_stock
       FROM inventories
       WHERE product_id = $1 AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [productId],
    )) as unknown as RawInventory[];
    const inventory = rows[0];
    if (!inventory) {
      throw new OrderCreationError(
        'INVENTORY_MISSING',
        'Sản phẩm chưa được thiết lập tồn kho!',
      );
    }
    return inventory;
  }

  private async countActiveVariants(
    queryRunner: QueryRunner,
    productId: string,
  ): Promise<number> {
    const [row] = (await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM product_variants
       WHERE product_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [productId],
    )) as unknown as CountRow[];
    return Number(row?.count ?? 0);
  }

  /**
   * Locks the voucher row and records redemption in the same transaction as
   * stock reservation and order creation. Concurrent checkouts therefore
   * serialize on this row and cannot exceed either global or per-user limits.
   */
  private async redeemVoucher(
    queryRunner: QueryRunner,
    code: string,
    userId: string,
    orderId: string,
    items: OrderItemView[],
    subtotal: number,
  ): Promise<{
    voucherId: string;
    voucherCode: string;
    discountAmount: number;
  }> {
    const [voucher] = (await queryRunner.query(
      `SELECT id, code, status, discount_type, discount_value,
              max_discount_amount, minimum_order_amount, scope, audience,
              issued_quantity, max_usage_count, usage_limit_per_user, used_count
       FROM vouchers
       WHERE UPPER(code) = UPPER($1) AND deleted_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [code],
    )) as unknown as LockedVoucher[];
    const invalid = (message: string): never => {
      throw new OrderCreationError('VOUCHER_INVALID', message);
    };
    if (!voucher) invalid('Mã voucher không tồn tại!');
    const [time] = (await queryRunner.query(
      `SELECT (status = 'active' AND start_at <= CURRENT_TIMESTAMP AND end_at > CURRENT_TIMESTAMP) AS valid
       FROM vouchers WHERE id = $1`,
      [voucher.id],
    )) as unknown as Array<{ valid: boolean }>;
    if (!time?.valid)
      invalid('Voucher chưa có hiệu lực, đã hết hạn hoặc đã bị tắt!');
    const effectiveLimit = Math.min(
      voucher.issued_quantity ?? Number.MAX_SAFE_INTEGER,
      voucher.max_usage_count ?? Number.MAX_SAFE_INTEGER,
    );
    if (voucher.used_count >= effectiveLimit)
      invalid('Voucher đã hết lượt sử dụng!');

    const [usage] = (await queryRunner.query(
      `SELECT COUNT(*) AS count FROM voucher_redemptions WHERE voucher_id = $1 AND user_id = $2`,
      [voucher.id, userId],
    )) as unknown as CountRow[];
    if (Number(usage?.count ?? 0) >= voucher.usage_limit_per_user)
      invalid('Bạn đã dùng hết số lượt cho voucher này!');

    await this.assertVoucherAudience(
      queryRunner,
      voucher,
      userId,
      orderId,
      invalid,
    );
    if (subtotal < Number(voucher.minimum_order_amount))
      invalid('Đơn hàng chưa đạt giá trị tối thiểu của voucher!');

    let eligibleAmount = subtotal;
    if (voucher.scope !== 'shop') {
      const productIds = items
        .map((item) => item.productId)
        .filter((id): id is string => Boolean(id));
      const rows = (await queryRunner.query(
        voucher.scope === 'products'
          ? `SELECT product_id AS id FROM voucher_products WHERE voucher_id = $1 AND product_id = ANY($2::uuid[])`
          : `SELECT p.id FROM products p INNER JOIN voucher_categories vc ON vc.category_id = p.category_id AND vc.voucher_id = $1 WHERE p.id = ANY($2::uuid[])`,
        [voucher.id, productIds],
      )) as unknown as Array<{ id: string }>;
      const eligibleIds = new Set(rows.map((row) => row.id));
      eligibleAmount = items
        .filter((item) => item.productId && eligibleIds.has(item.productId))
        .reduce((sum, item) => sum + item.subtotal, 0);
      if (eligibleAmount <= 0)
        invalid('Voucher không áp dụng cho sản phẩm trong đơn hàng!');
    }

    let discountAmount =
      voucher.discount_type === 'percentage'
        ? (eligibleAmount * Number(voucher.discount_value)) / 100
        : Number(voucher.discount_value);
    if (voucher.max_discount_amount != null)
      discountAmount = Math.min(
        discountAmount,
        Number(voucher.max_discount_amount),
      );
    discountAmount = Math.min(
      Math.round(discountAmount * 100) / 100,
      eligibleAmount,
      subtotal,
    );

    const result: unknown = await queryRunner.query(
      `UPDATE vouchers SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND used_count = $2
         AND ($3::integer IS NULL OR used_count < $3)
         AND ($4::integer IS NULL OR used_count < $4)
       RETURNING id`,
      [
        voucher.id,
        voucher.used_count,
        voucher.issued_quantity,
        voucher.max_usage_count,
      ],
    );
    if (extractPostgresRows<{ id: string }>(result).length === 0)
      invalid('Voucher vừa hết lượt sử dụng!');
    await queryRunner.query(
      `INSERT INTO voucher_redemptions (voucher_id, user_id, order_id, discount_amount) VALUES ($1, $2, $3, $4)`,
      [voucher.id, userId, orderId, discountAmount],
    );
    return { voucherId: voucher.id, voucherCode: voucher.code, discountAmount };
  }

  private async assertVoucherAudience(
    queryRunner: QueryRunner,
    voucher: LockedVoucher,
    userId: string,
    currentOrderId: string,
    invalid: (message: string) => never,
  ): Promise<void> {
    if (voucher.audience === 'all') return;
    if (voucher.audience === 'specific_customers') {
      const rows = (await queryRunner.query(
        `SELECT 1 FROM voucher_customers WHERE voucher_id = $1 AND user_id = $2`,
        [voucher.id, userId],
      )) as unknown[];
      if (!rows.length) invalid('Voucher không dành cho tài khoản này!');
      return;
    }
    if (voucher.audience === 'member_groups') {
      const rows = (await queryRunner.query(
        `SELECT 1 FROM voucher_customer_groups vcg INNER JOIN customer_group_members cgm ON cgm.group_id = vcg.group_id WHERE vcg.voucher_id = $1 AND cgm.user_id = $2 LIMIT 1`,
        [voucher.id, userId],
      )) as unknown[];
      if (!rows.length)
        invalid('Tài khoản không thuộc nhóm thành viên được áp dụng!');
      return;
    }
    const [history] = (await queryRunner.query(
      `SELECT COUNT(*) AS count FROM orders WHERE user_id = $1 AND id <> $2 AND deleted_at IS NULL AND status NOT IN ('cancelled','rejected')`,
      [userId, currentOrderId],
    )) as unknown as CountRow[];
    const hasPreviousOrder = Number(history?.count ?? 0) > 0;
    if (voucher.audience === 'new_customers' && hasPreviousOrder)
      invalid('Voucher chỉ dành cho khách hàng mới!');
    if (voucher.audience === 'existing_customers' && !hasPreviousOrder)
      invalid('Voucher chỉ dành cho khách hàng cũ!');
  }

  private async restockOrder(
    queryRunner: QueryRunner,
    orderId: string,
    actorId: string,
    reason: string,
  ): Promise<void> {
    const items = (await queryRunner.query(
      `SELECT product_id, variant_id, quantity
       FROM order_items
       WHERE order_id = $1 AND deleted_at IS NULL
       ORDER BY product_id ASC, variant_id ASC NULLS FIRST
       FOR UPDATE`,
      [orderId],
    )) as unknown as Array<{
      product_id: string | null;
      variant_id: string | null;
      quantity: number;
    }>;

    await setDatabaseAuditContext(queryRunner, {
      actorId,
      inventoryReason: reason,
      inventoryType: 'order_restock',
    });
    for (const item of items) {
      if (!item.product_id) continue;
      await queryRunner.query(
        `SELECT id FROM products
         WHERE id = $1 AND deleted_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [item.product_id],
      );
      if (item.variant_id) {
        await queryRunner.query(
          `SELECT id FROM product_variants
           WHERE id = $1 AND deleted_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [item.variant_id],
        );
      }
      const [inventory] = (await queryRunner.query(
        `SELECT id, stock FROM inventories
         WHERE product_id = $1 AND deleted_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [item.product_id],
      )) as unknown as Array<{ id: string; stock: number }>;
      if (!inventory) continue;

      if (item.variant_id) {
        await queryRunner.query(
          `UPDATE product_variants
           SET stock = stock + $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [item.variant_id, item.quantity],
        );
      }
      await queryRunner.query(
        `UPDATE inventories
         SET stock = stock + $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [inventory.id, item.quantity],
      );
    }
  }

  private mapOrderItem(row: RawOrderItem): OrderItemView {
    return {
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id,
      productName: row.product_name,
      variantName: row.variant_name,
      variantValue: row.variant_value,
      variantSku: row.variant_sku,
      unitPrice: Number(row.unit_price),
      quantity: row.quantity,
      subtotal: Number(row.subtotal),
    };
  }

  private mapOrder(row: RawOrder, items: OrderItemView[]): OrderView {
    return {
      id: row.id,
      orderCode: row.order_code,
      userId: row.user_id,
      status: row.status,
      totalAmount: Number(row.total_amount),
      subtotalAmount: Number(row.subtotal_amount ?? row.total_amount),
      discountAmount: Number(row.discount_amount ?? 0),
      voucherId: row.voucher_id ?? null,
      voucherCode: row.voucher_code ?? null,
      shippingAddress: row.shipping_address,
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      note: row.note,
      rejectionReason: row.rejection_reason,
      rejectedAt: row.rejected_at,
      confirmedAt: row.confirmed_at,
      cancellationReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at,
      cancelledBy: row.cancelled_by,
      returnReason: row.return_reason,
      returnEvidence: row.return_evidence ?? [],
      returnRequestedAt: row.return_requested_at,
      returnReviewReason: row.return_review_reason,
      returnReviewedAt: row.return_reviewed_at,
      returnReviewedBy: row.return_reviewed_by,
      stockRestoredAt: row.stock_restored_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      items,
    };
  }

  private generateOrderCode(): string {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `ORD-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async findByIdempotencyKey(
    userId: string,
    idempotency: OrderIdempotencyInput,
  ): Promise<OrderView | null> {
    const [row] = (await this.dataSource.query(
      `SELECT id, request_fingerprint
       FROM orders
       WHERE user_id = $1 AND idempotency_key = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [userId, idempotency.key],
    )) as unknown as { id: string; request_fingerprint: string }[];
    if (!row) return null;
    if (row.request_fingerprint !== idempotency.fingerprint) {
      throw new OrderCreationError(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency-Key đã được dùng cho một yêu cầu khác!',
      );
    }
    return this.findById(row.id, userId);
  }

  private lineLockKey(line: RequestedLine): string {
    return `${line.productId ?? line.productSku?.toLowerCase() ?? ''}:${
      line.variantId ?? line.variantSku?.toLowerCase() ?? ''
    }`;
  }

  private isRetryableTransactionError(error: unknown): boolean {
    const code = this.postgresErrorCode(error);
    return code === '40P01' || code === '40001';
  }

  private isUniqueViolation(error: unknown): boolean {
    return this.postgresErrorCode(error) === '23505';
  }

  private postgresErrorCode(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return undefined;
    }
    return typeof error.code === 'string' ? error.code : undefined;
  }
}
