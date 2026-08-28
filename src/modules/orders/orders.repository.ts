import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { extractPostgresRows } from '@common/database/postgres-query-result';
import { OrderStatus } from '@entities';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { OrderQueryDto } from './dto/order-query.dto';

export type OrderCreationErrorCode =
  | 'CART_EMPTY'
  | 'PRODUCT_REFERENCE_REQUIRED'
  | 'PRODUCT_UNAVAILABLE'
  | 'VARIANT_REQUIRED'
  | 'VARIANT_INVALID'
  | 'INVENTORY_MISSING'
  | 'STOCK_EXCEEDED';

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
  shippingAddress: string;
  recipientName: string;
  recipientPhone: string;
  note: string | null;
  rejectionReason: string | null;
  rejectedAt: Date | null;
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
  shipping_address: string;
  recipient_name: string;
  recipient_phone: string;
  note: string | null;
  rejection_reason: string | null;
  rejected_at: Date | null;
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

@Injectable()
export class OrdersRepository {
  constructor(private readonly dataSource: DataSource) {}

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
        OR COALESCE(u.email, '') ILIKE ${value}
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
              o.shipping_address, o.recipient_name, o.recipient_phone, o.note,
              o.rejection_reason, o.rejected_at, o.created_at, o.updated_at,
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
              o.shipping_address, o.recipient_name, o.recipient_phone, o.note,
              o.rejection_reason, o.rejected_at, o.created_at, o.updated_at,
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
       SET status = $3, updated_at = CURRENT_TIMESTAMP
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
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = $4 AND deleted_at IS NULL
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
      const items = (await queryRunner.query(
        `SELECT product_id, variant_id, quantity
         FROM order_items
         WHERE order_id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [id],
      )) as unknown as {
        product_id: string | null;
        variant_id: string | null;
        quantity: number;
      }[];
      for (const item of items) {
        if (!item.product_id) continue;
        const [inventory] = (await queryRunner.query(
          `SELECT id, stock FROM inventories
           WHERE product_id = $1 AND deleted_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [item.product_id],
        )) as unknown as { id: string; stock: number }[];
        if (inventory) {
          const nextStock = inventory.stock + item.quantity;
          await setDatabaseAuditContext(queryRunner, {
            actorId,
            inventoryReason: `Từ chối đơn ${updated.order_code}: ${reason}`,
            inventoryType: 'order_restock',
          });
          if (item.variant_id) {
            await queryRunner.query(
              `UPDATE product_variants
               SET stock = stock + $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [item.variant_id, item.quantity],
            );
          }
          await queryRunner.query(
            `UPDATE inventories SET stock = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [inventory.id, nextStock],
          );
        }
      }
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

  createFromCart(
    userId: string,
    recipient: OrderRecipientInput,
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
    );
  }

  createBuyNow(
    userId: string,
    recipient: OrderRecipientInput,
    item: BuyNowInput,
  ): Promise<OrderView> {
    return this.createOrder(
      userId,
      recipient,
      () => Promise.resolve([item]),
      false,
    );
  }

  private async createOrder(
    userId: string,
    recipient: OrderRecipientInput,
    loadLines: (queryRunner: QueryRunner) => Promise<RequestedLine[]>,
    clearCart: boolean,
  ): Promise<OrderView> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId: userId });
      const lines = await loadLines(queryRunner);
      const order = await this.insertOrder(queryRunner, userId, recipient);
      const items: OrderItemView[] = [];
      let totalAmount = 0;

      for (const line of lines) {
        const item = await this.reserveLine(queryRunner, line, order);
        items.push(item);
        totalAmount += item.subtotal;
      }

      await queryRunner.query(
        `UPDATE orders
         SET total_amount = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [order.id, totalAmount],
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
        totalAmount,
        shippingAddress: order.shipping_address,
        recipientName: order.recipient_name,
        recipientPhone: order.recipient_phone,
        note: order.note,
        rejectionReason: null,
        rejectedAt: null,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        items,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async insertOrder(
    queryRunner: QueryRunner,
    userId: string,
    recipient: OrderRecipientInput,
  ): Promise<RawOrder> {
    const orderCode = this.generateOrderCode();
    const rows = (await queryRunner.query(
      `INSERT INTO orders
         (order_code, user_id, status, total_amount, shipping_address,
          recipient_name, recipient_phone, note)
       VALUES ($1, $2, $3, 0, $4, $5, $6, $7)
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
      `SELECT p.id, p.name, p.sku, p.unit_price
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
      shippingAddress: row.shipping_address,
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      note: row.note,
      rejectionReason: row.rejection_reason,
      rejectedAt: row.rejected_at,
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
}
