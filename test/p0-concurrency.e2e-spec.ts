import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CartRepository } from '../src/modules/cart/cart.repository';
import { OrdersRepository } from '../src/modules/orders/orders.repository';

jest.setTimeout(30_000);

describe('P0 concurrency guards (PostgreSQL)', () => {
  let dataSource: DataSource;
  let ordersRepository: OrdersRepository;
  let cartRepository: CartRepository;
  const cleanupIds = new Set<string>();

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_DATABASE ?? 'ecommerce_db',
    });
    await dataSource.initialize();
    ordersRepository = new OrdersRepository(dataSource);
    cartRepository = new CartRepository(dataSource);
  });

  afterEach(async () => {
    const ids = [...cleanupIds];
    if (ids.length === 0) return;
    await dataSource.query(
      `DELETE FROM order_items WHERE order_id IN (
         SELECT id FROM orders WHERE user_id = ANY($1::uuid[])
       )`,
      [ids],
    );
    await dataSource.query(
      `DELETE FROM orders WHERE user_id = ANY($1::uuid[])`,
      [ids],
    );
    await dataSource.query(
      `DELETE FROM cart_items WHERE cart_id IN (
         SELECT id FROM carts WHERE user_id = ANY($1::uuid[])
       )`,
      [ids],
    );
    await dataSource.query(
      `DELETE FROM carts WHERE user_id = ANY($1::uuid[])`,
      [ids],
    );
    await dataSource.query(
      `DELETE FROM inventories WHERE product_id = ANY($1::uuid[])`,
      [ids],
    );
    await dataSource.query(`DELETE FROM products WHERE id = ANY($1::uuid[])`, [
      ids,
    ]);
    await dataSource.query(
      `DELETE FROM audit_logs
       WHERE actor_id = ANY($1::uuid[]) OR entity_id = ANY($1::text[])`,
      [ids],
    );
    await dataSource.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
      ids,
    ]);
    await dataSource.query(
      `DELETE FROM audit_logs WHERE entity_id = ANY($1::text[])`,
      [ids],
    );
    cleanupIds.clear();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('creates one order and reserves stock once for concurrent duplicate requests', async () => {
    const { userId, productId, inventoryId, cartId } = await createFixture(
      dataSource,
      5,
    );
    cleanupIds.add(userId);
    cleanupIds.add(productId);
    cleanupIds.add(cartId);
    cleanupIds.add(inventoryId);
    await dataSource.query(
      `INSERT INTO cart_items (id, cart_id, product_id, quantity)
       VALUES ($1, $2, $3, 1)`,
      [randomUUID(), cartId, productId],
    );
    const idempotency = {
      key: randomUUID(),
      fingerprint: 'a'.repeat(64),
    };

    const orders = await Promise.all(
      Array.from({ length: 12 }, () =>
        ordersRepository.createFromCart(
          userId,
          {
            recipientName: 'Concurrency Test',
            recipientPhone: '0900000000',
            shippingAddress: 'Test address',
          },
          idempotency,
        ),
      ),
    );

    expect(new Set(orders.map((order) => order.id)).size).toBe(1);
    const countRows = (await dataSource.query(
      `SELECT COUNT(*) AS count FROM orders
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, idempotency.key],
    )) as unknown as { count: string }[];
    const stockRows = (await dataSource.query(
      `SELECT stock FROM inventories WHERE product_id = $1`,
      [productId],
    )) as unknown as { stock: number }[];
    const count = countRows[0]?.count ?? '0';
    const stock = stockRows[0]?.stock;
    expect(Number(count)).toBe(1);
    expect(stock).toBe(4);
  });

  it('atomically caps concurrent cart additions at available stock', async () => {
    const { userId, productId, inventoryId, cartId } = await createFixture(
      dataSource,
      5,
    );
    cleanupIds.add(userId);
    cleanupIds.add(productId);
    cleanupIds.add(cartId);
    cleanupIds.add(inventoryId);

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        cartRepository.addItemAtomic(cartId, productId, null, 1, 5, false),
      ),
    );
    const quantityRows = (await dataSource.query(
      `SELECT quantity FROM cart_items
       WHERE cart_id = $1 AND product_id = $2 AND variant_id IS NULL`,
      [cartId, productId],
    )) as unknown as { quantity: number }[];
    const quantity = quantityRows[0]?.quantity;

    expect(results.filter((result) => result.status === 'saved')).toHaveLength(
      5,
    );
    expect(
      results.filter((result) => result.status === 'stock_exceeded'),
    ).toHaveLength(7);
    expect(quantity).toBe(5);
  });
});

async function createFixture(dataSource: DataSource, stock: number) {
  const userId = randomUUID();
  const productId = randomUUID();
  const inventoryId = randomUUID();
  const cartId = randomUUID();
  const suffix = randomUUID();
  await dataSource.query(
    `INSERT INTO users (id, email, password, phone, full_name)
     VALUES ($1, $2, 'test-password-hash', $3, 'Concurrency Test')`,
    [
      userId,
      `p0-${suffix}@example.com`,
      `09${suffix.replaceAll('-', '').slice(0, 8)}`,
    ],
  );
  await dataSource.query(
    `INSERT INTO products
       (id, name, slug, sku, unit_price, is_active, images)
     VALUES ($1, 'P0 Test Product', $2, $3, 1000, TRUE, '[]'::jsonb)`,
    [productId, `p0-product-${suffix}`, `P0-${suffix}`],
  );
  await dataSource.query(
    `INSERT INTO inventories (id, product_id, stock, reserved_stock)
     VALUES ($1, $2, $3, 0)`,
    [inventoryId, productId, stock],
  );
  await dataSource.query(`INSERT INTO carts (id, user_id) VALUES ($1, $2)`, [
    cartId,
    userId,
  ]);
  return { userId, productId, inventoryId, cartId };
}
