import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface DashboardPeriod {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  bucket: 'hour' | 'day' | 'week';
}

export interface MetricSnapshot {
  revenue: number;
  completedOrders: number;
  soldProducts: number;
  newCustomers: number;
  totalOrders: number;
  cancelledOrders: number;
}

export interface DashboardSeriesPoint {
  date: Date;
  revenue: number;
  orders: number;
  soldProducts: number;
}

export interface DashboardOrderStatuses {
  pending: number;
  confirmed: number;
  processing: number;
  shipping: number;
  completed: number;
  cancelled: number;
  returned: number;
}

export interface DashboardTopProduct {
  productId: string | null;
  name: string;
  sold: number;
  revenue: number;
}

export interface DashboardLowStockItem {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  sku: string | null;
  stock: number;
  totalCount: number;
}

export interface DashboardCustomerSegments {
  newCustomers: number;
  returningCustomers: number;
}

export interface DashboardTopCustomer {
  userId: string;
  name: string;
  email: string | null;
  orderCount: number;
  totalSpent: number;
}

interface RawMetricOrder {
  revenue: string | number;
  completed_orders: string | number;
  total_orders: string | number;
  cancelled_orders: string | number;
}

interface RawCount {
  count: string | number;
}

interface RawSeries {
  bucket: Date;
  revenue: string | number;
  orders: string | number;
  sold_products: string | number;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getMetricSnapshot(start: Date, end: Date): Promise<MetricSnapshot> {
    const [[orders], [sold], [customers]] = await Promise.all([
      this.dataSource.query<RawMetricOrder[]>(
        `SELECT
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) AS revenue,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
           COUNT(*) AS total_orders,
           COUNT(*) FILTER (WHERE status IN ('cancelled', 'rejected')) AS cancelled_orders
         FROM orders
         WHERE created_at >= $1 AND created_at < $2 AND deleted_at IS NULL`,
        [start, end],
      ),
      this.dataSource.query<RawCount[]>(
        `SELECT COALESCE(SUM(item.quantity), 0) AS count
         FROM order_items item
         INNER JOIN orders order_row ON order_row.id = item.order_id
         WHERE order_row.status = 'completed'
           AND order_row.created_at >= $1 AND order_row.created_at < $2
           AND order_row.deleted_at IS NULL AND item.deleted_at IS NULL`,
        [start, end],
      ),
      this.dataSource.query<RawCount[]>(
        `SELECT COUNT(DISTINCT user_row.id) AS count
         FROM users user_row
         INNER JOIN user_roles user_role
           ON user_role.user_id = user_row.id AND user_role.deleted_at IS NULL
         INNER JOIN roles role_row
           ON role_row.id = user_role.role_id
          AND role_row.name = 'customer' AND role_row.deleted_at IS NULL
         WHERE user_row.created_at >= $1 AND user_row.created_at < $2
           AND user_row.deleted_at IS NULL`,
        [start, end],
      ),
    ]);

    return {
      revenue: Number(orders?.revenue ?? 0),
      completedOrders: Number(orders?.completed_orders ?? 0),
      soldProducts: Number(sold?.count ?? 0),
      newCustomers: Number(customers?.count ?? 0),
      totalOrders: Number(orders?.total_orders ?? 0),
      cancelledOrders: Number(orders?.cancelled_orders ?? 0),
    };
  }

  async getSeries(period: DashboardPeriod): Promise<DashboardSeriesPoint[]> {
    const interval =
      period.bucket === 'hour'
        ? `interval '1 hour'`
        : period.bucket === 'week'
          ? `interval '7 days'`
          : `interval '1 day'`;
    const rows = await this.dataSource.query<RawSeries[]>(
      `WITH buckets AS (
         SELECT generate_series(
           $1::timestamptz,
           GREATEST(
             $1::timestamptz,
             $2::timestamptz - interval '1 microsecond'
           ),
           ${interval}
         ) AS bucket
       ), order_totals AS (
         SELECT order_row.id, order_row.created_at, order_row.status,
                order_row.total_amount,
                COALESCE(SUM(item.quantity), 0) AS sold_products
         FROM orders order_row
         LEFT JOIN order_items item
           ON item.order_id = order_row.id AND item.deleted_at IS NULL
         WHERE order_row.created_at >= $1 AND order_row.created_at < $2
           AND order_row.deleted_at IS NULL
         GROUP BY order_row.id
       )
       SELECT bucket.bucket,
              COALESCE(SUM(order_row.total_amount)
                FILTER (WHERE order_row.status = 'completed'), 0) AS revenue,
              COUNT(order_row.id) AS orders,
              COALESCE(SUM(order_row.sold_products)
                FILTER (WHERE order_row.status = 'completed'), 0) AS sold_products
       FROM buckets bucket
       LEFT JOIN order_totals order_row
         ON order_row.created_at >= bucket.bucket
        AND order_row.created_at < bucket.bucket + ${interval}
       GROUP BY bucket.bucket
       ORDER BY bucket.bucket`,
      [period.start, period.end],
    );
    return rows.map((row) => ({
      date: row.bucket,
      revenue: Number(row.revenue),
      orders: Number(row.orders),
      soldProducts: Number(row.sold_products),
    }));
  }

  async getOrderStatuses(
    start: Date,
    end: Date,
  ): Promise<DashboardOrderStatuses> {
    const rows = await this.dataSource.query<
      Array<{ status: string; count: string | number }>
    >(
      `SELECT status, COUNT(*) AS count
       FROM orders
       WHERE created_at >= $1 AND created_at < $2 AND deleted_at IS NULL
       GROUP BY status`,
      [start, end],
    );
    const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
    return {
      pending: counts.get('pending') ?? 0,
      confirmed: counts.get('confirmed') ?? 0,
      processing: counts.get('processing') ?? 0,
      shipping: counts.get('shipping') ?? 0,
      completed: counts.get('completed') ?? 0,
      cancelled: (counts.get('cancelled') ?? 0) + (counts.get('rejected') ?? 0),
      returned: 0,
    };
  }

  async countPendingOrders(): Promise<number> {
    const [row] = await this.dataSource.query<RawCount[]>(
      `SELECT COUNT(*) AS count FROM orders
       WHERE status = 'pending' AND deleted_at IS NULL`,
    );
    return Number(row?.count ?? 0);
  }

  async getTopProducts(start: Date, end: Date): Promise<DashboardTopProduct[]> {
    const rows = await this.dataSource.query<
      Array<{
        product_id: string | null;
        name: string;
        sold: string | number;
        revenue: string | number;
      }>
    >(
      `SELECT item.product_id, item.product_name AS name,
              SUM(item.quantity) AS sold, SUM(item.subtotal) AS revenue
       FROM order_items item
       INNER JOIN orders order_row ON order_row.id = item.order_id
       WHERE order_row.status = 'completed'
         AND order_row.created_at >= $1 AND order_row.created_at < $2
         AND order_row.deleted_at IS NULL AND item.deleted_at IS NULL
       GROUP BY item.product_id, item.product_name
       ORDER BY sold DESC, revenue DESC
       LIMIT 8`,
      [start, end],
    );
    return rows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      sold: Number(row.sold),
      revenue: Number(row.revenue),
    }));
  }

  async getLowStock(): Promise<DashboardLowStockItem[]> {
    const rows = await this.dataSource.query<
      Array<{
        product_id: string;
        product_name: string;
        variant_id: string | null;
        variant_name: string | null;
        sku: string | null;
        stock: string | number;
        total_count: string | number;
      }>
    >(
      `WITH low_stock AS (
         SELECT product.id AS product_id, product.name AS product_name,
                variant.id AS variant_id,
                CONCAT_WS(' · ', variant.name, variant.value) AS variant_name,
                variant.sku, variant.stock
         FROM products product
         INNER JOIN product_variants variant
           ON variant.product_id = product.id
          AND variant.deleted_at IS NULL AND variant.is_active = TRUE
         WHERE product.deleted_at IS NULL AND product.is_active = TRUE
           AND variant.stock < 5
           AND NOT EXISTS (
             SELECT 1 FROM product_variants child
             WHERE child.parent_id = variant.id AND child.deleted_at IS NULL
           )
         UNION ALL
         SELECT product.id, product.name, NULL, NULL, product.sku,
                inventory.stock
         FROM products product
         INNER JOIN inventories inventory
           ON inventory.product_id = product.id AND inventory.deleted_at IS NULL
         WHERE product.deleted_at IS NULL AND product.is_active = TRUE
           AND inventory.stock < 5
           AND NOT EXISTS (
             SELECT 1 FROM product_variants variant
             WHERE variant.product_id = product.id
               AND variant.deleted_at IS NULL AND variant.is_active = TRUE
           )
       )
       SELECT *, COUNT(*) OVER() AS total_count
       FROM low_stock
       ORDER BY stock ASC, product_name ASC
       LIMIT 10`,
    );
    return rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      variantId: row.variant_id,
      variantName: row.variant_name,
      sku: row.sku,
      stock: Number(row.stock),
      totalCount: Number(row.total_count),
    }));
  }

  async getCustomerSegments(
    start: Date,
    end: Date,
  ): Promise<DashboardCustomerSegments> {
    const [row] = await this.dataSource.query<
      Array<{
        new_customers: string | number;
        returning_customers: string | number;
      }>
    >(
      `WITH customer_orders AS (
         SELECT user_id, MIN(created_at) AS first_order_at,
                BOOL_OR(created_at >= $1 AND created_at < $2) AS active_in_period
         FROM orders
         WHERE status = 'completed' AND deleted_at IS NULL
         GROUP BY user_id
       )
       SELECT
         COUNT(*) FILTER (
           WHERE first_order_at >= $1 AND first_order_at < $2
         ) AS new_customers,
         COUNT(*) FILTER (
           WHERE first_order_at < $1 AND active_in_period = TRUE
         ) AS returning_customers
       FROM customer_orders`,
      [start, end],
    );
    return {
      newCustomers: Number(row?.new_customers ?? 0),
      returningCustomers: Number(row?.returning_customers ?? 0),
    };
  }

  async getTopCustomers(
    start: Date,
    end: Date,
  ): Promise<DashboardTopCustomer[]> {
    const rows = await this.dataSource.query<
      Array<{
        user_id: string;
        name: string | null;
        email: string | null;
        order_count: string | number;
        total_spent: string | number;
      }>
    >(
      `SELECT user_row.id AS user_id, user_row.full_name AS name,
              user_row.email, COUNT(order_row.id) AS order_count,
              SUM(order_row.total_amount) AS total_spent
       FROM orders order_row
       INNER JOIN users user_row ON user_row.id = order_row.user_id
       WHERE order_row.status = 'completed'
         AND order_row.created_at >= $1 AND order_row.created_at < $2
         AND order_row.deleted_at IS NULL AND user_row.deleted_at IS NULL
       GROUP BY user_row.id
       ORDER BY total_spent DESC, order_count DESC
       LIMIT 6`,
      [start, end],
    );
    return rows.map((row) => ({
      userId: row.user_id,
      name: row.name ?? row.email ?? 'Khách hàng',
      email: row.email,
      orderCount: Number(row.order_count),
      totalSpent: Number(row.total_spent),
    }));
  }

  countPendingRefunds(): Promise<number> {
    // Payment hiện chưa có trạng thái refund_requested; không suy diễn từ refunded.
    return Promise.resolve(0);
  }

  countUnansweredReviews(): Promise<number> {
    // Module đánh giá chưa tồn tại trong schema hiện tại.
    return Promise.resolve(0);
  }
}
