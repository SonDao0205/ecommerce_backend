import { Injectable } from '@nestjs/common';
import {
  Cart,
  CartItem,
  Category,
  Inventory,
  Product,
  ProductVariant,
} from '@entities';
import { DataSource } from 'typeorm';

interface RawCartRow {
  id: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RawCartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  product_name?: string;
  product_slug?: string;
  product_sku?: string | null;
  product_unit_price?: number | string;
  product_thumbnail_url?: string | null;
  product_is_active?: boolean;
  product_category_id?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  variant_name?: string | null;
  variant_value?: string | null;
  variant_sku?: string | null;
  variant_unit_price?: number | string | null;
  variant_stock?: number | null;
  variant_product_id?: string | null;
  variant_parent_id?: string | null;
  variant_is_active?: boolean | null;
}

interface RawProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  unit_price: number | string;
  original_price: number | string | null;
  thumbnail_url: string | null;
  images: unknown;
  is_active: boolean;
  category_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RawVariantRow {
  id: string;
  product_id: string;
  parent_id: string | null;
  name: string;
  value: string;
  sku: string | null;
  unit_price: number | string | null;
  stock: number;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RawInventoryRow {
  id: string;
  product_id: string;
  stock: number;
  reserved_stock: number;
  low_stock_threshold: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface CountRow {
  count: number | string;
}

export type AtomicCartWriteResult =
  | { status: 'saved'; item: CartItem }
  | { status: 'skipped' | 'stock_exceeded' };

@Injectable()
export class CartRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findCartByUserId(userId: string): Promise<Cart | null> {
    const [row] = await this.dataSource.query<RawCartRow[]>(
      `SELECT id, user_id, created_at, updated_at, deleted_at
       FROM carts
       WHERE user_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    return row ? this.mapCart(row) : null;
  }

  async createCart(userId: string): Promise<Cart> {
    const [row] = await this.dataSource.query<RawCartRow[]>(
      `INSERT INTO carts (user_id)
       VALUES ($1)
       ON CONFLICT (user_id)
       DO UPDATE SET updated_at = carts.updated_at
       RETURNING id, user_id, created_at, updated_at, deleted_at`,
      [userId],
    );
    if (!row) throw new Error('Không thể tạo giỏ hàng');
    return this.mapCart(row);
  }

  async findItems(cartId: string): Promise<CartItem[]> {
    const rows = await this.dataSource.query<RawCartItemRow[]>(
      `SELECT
         ci.id, ci.cart_id, ci.product_id, ci.variant_id, ci.quantity,
         ci.created_at, ci.updated_at, ci.deleted_at,
         p.name AS product_name, p.slug AS product_slug,
         p.sku AS product_sku, p.unit_price AS product_unit_price,
         p.thumbnail_url AS product_thumbnail_url,
         p.is_active AS product_is_active,
         p.category_id AS product_category_id,
         c.name AS category_name, c.slug AS category_slug,
         v.name AS variant_name, v.value AS variant_value,
         v.sku AS variant_sku, v.unit_price AS variant_unit_price,
         v.stock AS variant_stock, v.product_id AS variant_product_id,
         v.parent_id AS variant_parent_id, v.is_active AS variant_is_active
       FROM cart_items ci
       INNER JOIN products p
         ON p.id = ci.product_id AND p.deleted_at IS NULL
       LEFT JOIN categories c
         ON c.id = p.category_id AND c.deleted_at IS NULL
       LEFT JOIN product_variants v
         ON v.id = ci.variant_id AND v.deleted_at IS NULL
       WHERE ci.cart_id = $1 AND ci.deleted_at IS NULL
       ORDER BY ci.created_at ASC`,
      [cartId],
    );
    return rows.map((row) => this.mapCartItem(row, true));
  }

  async findItem(
    cartId: string,
    productId: string,
    variantId?: string | null,
  ): Promise<CartItem | null> {
    const [row] = await this.dataSource.query<RawCartItemRow[]>(
      `SELECT id, cart_id, product_id, variant_id, quantity,
              created_at, updated_at, deleted_at
       FROM cart_items
       WHERE cart_id = $1
         AND product_id = $2
         AND variant_id IS NOT DISTINCT FROM $3::uuid
         AND deleted_at IS NULL
       LIMIT 1`,
      [cartId, productId, variantId ?? null],
    );
    return row ? this.mapCartItem(row) : null;
  }

  async findItemForUser(
    itemId: string,
    userId: string,
  ): Promise<CartItem | null> {
    const [row] = await this.dataSource.query<RawCartItemRow[]>(
      `SELECT
         ci.id, ci.cart_id, ci.product_id, ci.variant_id, ci.quantity,
         ci.created_at, ci.updated_at, ci.deleted_at,
         p.name AS product_name, p.slug AS product_slug,
         p.sku AS product_sku, p.unit_price AS product_unit_price,
         p.thumbnail_url AS product_thumbnail_url,
         p.is_active AS product_is_active,
         p.category_id AS product_category_id,
         v.name AS variant_name, v.value AS variant_value,
         v.sku AS variant_sku, v.unit_price AS variant_unit_price,
         v.stock AS variant_stock, v.product_id AS variant_product_id,
         v.parent_id AS variant_parent_id, v.is_active AS variant_is_active
       FROM cart_items ci
       INNER JOIN carts cart
         ON cart.id = ci.cart_id
        AND cart.user_id = $2
        AND cart.deleted_at IS NULL
       INNER JOIN products p
         ON p.id = ci.product_id AND p.deleted_at IS NULL
       LEFT JOIN product_variants v
         ON v.id = ci.variant_id AND v.deleted_at IS NULL
       WHERE ci.id = $1 AND ci.deleted_at IS NULL
       LIMIT 1`,
      [itemId, userId],
    );
    return row ? this.mapCartItem(row, true) : null;
  }

  async findProduct(
    productId?: string,
    productSku?: string,
  ): Promise<Product | null> {
    const [row] = await this.dataSource.query<RawProductRow[]>(
      `SELECT id, name, slug, description, sku, unit_price, original_price,
              thumbnail_url, images, is_active, category_id,
              created_at, updated_at, deleted_at
       FROM products
       WHERE ${productId ? 'id = $1' : 'LOWER(sku) = LOWER($1)'}
         AND is_active = TRUE
         AND deleted_at IS NULL
       LIMIT 1`,
      [productId ?? productSku],
    );
    return row ? this.mapProduct(row) : null;
  }

  async findVariant(
    variantId?: string,
    variantSku?: string,
  ): Promise<ProductVariant | null> {
    const [row] = await this.dataSource.query<RawVariantRow[]>(
      `SELECT id, product_id, parent_id, name, value, sku, unit_price,
              stock, sort_order, is_active, created_at, updated_at, deleted_at
       FROM product_variants
       WHERE ${variantId ? 'id = $1' : 'LOWER(sku) = LOWER($1)'}
         AND is_active = TRUE
         AND deleted_at IS NULL
       LIMIT 1`,
      [variantId ?? variantSku],
    );
    return row ? this.mapVariant(row) : null;
  }

  async countActiveVariants(productId: string): Promise<number> {
    const [row] = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*) AS count
       FROM product_variants
       WHERE product_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [productId],
    );
    return Number(row?.count ?? 0);
  }

  async countActiveVariantChildren(variantId: string): Promise<number> {
    const [row] = await this.dataSource.query<CountRow[]>(
      `SELECT COUNT(*) AS count
       FROM product_variants
       WHERE parent_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [variantId],
    );
    return Number(row?.count ?? 0);
  }

  async findInventory(productId: string): Promise<Inventory | null> {
    const [row] = await this.dataSource.query<RawInventoryRow[]>(
      `SELECT id, product_id, stock, reserved_stock, low_stock_threshold,
              created_at, updated_at, deleted_at
       FROM inventories
       WHERE product_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [productId],
    );
    return row ? this.mapInventory(row) : null;
  }

  async saveItem(item: CartItem): Promise<CartItem> {
    const rows = item.id
      ? await this.dataSource.query<RawCartItemRow[]>(
          `UPDATE cart_items
           SET quantity = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING id, cart_id, product_id, variant_id, quantity,
                     created_at, updated_at, deleted_at`,
          [item.id, item.quantity ?? 1],
        )
      : await this.dataSource.query<RawCartItemRow[]>(
          `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
           VALUES ($1, $2, $3, $4)
           RETURNING id, cart_id, product_id, variant_id, quantity,
                     created_at, updated_at, deleted_at`,
          [
            item.cartId,
            item.productId,
            item.variantId ?? null,
            item.quantity ?? 1,
          ],
        );
    const row = rows[0];
    if (!row) throw new Error('Không thể lưu sản phẩm trong giỏ hàng');
    return this.mapCartItem(row);
  }

  async addItemAtomic(
    cartId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
    maxQuantity: number,
    ignoreExisting: boolean,
  ): Promise<AtomicCartWriteResult> {
    if (quantity > maxQuantity) return { status: 'stock_exceeded' };

    const conflictTarget = variantId
      ? `(cart_id, product_id, variant_id) WHERE variant_id IS NOT NULL`
      : `(cart_id, product_id) WHERE variant_id IS NULL`;
    const conflictAction = ignoreExisting
      ? 'DO NOTHING'
      : `DO UPDATE
         SET quantity = cart_items.quantity + EXCLUDED.quantity,
             updated_at = CURRENT_TIMESTAMP
         WHERE cart_items.quantity + EXCLUDED.quantity <= $5`;
    const rows = await this.dataSource.query<RawCartItemRow[]>(
      `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ${conflictTarget} ${conflictAction}
       RETURNING id, cart_id, product_id, variant_id, quantity,
                 created_at, updated_at, deleted_at`,
      ignoreExisting
        ? [cartId, productId, variantId, quantity]
        : [cartId, productId, variantId, quantity, maxQuantity],
    );
    const row = rows[0];
    if (row) return { status: 'saved', item: this.mapCartItem(row) };
    return { status: ignoreExisting ? 'skipped' : 'stock_exceeded' };
  }

  createItem(data: Partial<CartItem>): CartItem {
    return Object.assign(new CartItem(), data);
  }

  async removeItem(item: CartItem): Promise<void> {
    await this.dataSource.query('DELETE FROM cart_items WHERE id = $1', [
      item.id,
    ]);
  }

  async clearCart(cartId: string): Promise<void> {
    await this.dataSource.query('DELETE FROM cart_items WHERE cart_id = $1', [
      cartId,
    ]);
  }

  private mapCart(row: RawCartRow): Cart {
    return Object.assign(new Cart(), {
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }

  private mapCartItem(row: RawCartItemRow, includeRelations = false): CartItem {
    const product =
      includeRelations && row.product_name
        ? Object.assign(new Product(), {
            id: row.product_id,
            name: row.product_name,
            slug: row.product_slug,
            sku: row.product_sku ?? undefined,
            unitPrice: Number(row.product_unit_price ?? 0),
            thumbnailUrl: row.product_thumbnail_url ?? undefined,
            isActive: row.product_is_active,
            categoryId: row.product_category_id ?? undefined,
            ...(row.product_category_id && {
              category: Object.assign(new Category(), {
                id: row.product_category_id,
                name: row.category_name ?? undefined,
                slug: row.category_slug ?? undefined,
              }),
            }),
          })
        : undefined;
    const variant =
      includeRelations && row.variant_id && row.variant_name
        ? Object.assign(new ProductVariant(), {
            id: row.variant_id,
            productId: row.variant_product_id,
            parentId: row.variant_parent_id,
            name: row.variant_name,
            value: row.variant_value,
            sku: row.variant_sku,
            unitPrice:
              row.variant_unit_price === null
                ? null
                : Number(row.variant_unit_price),
            stock: row.variant_stock ?? 0,
            isActive: row.variant_is_active ?? false,
          })
        : undefined;
    return Object.assign(new CartItem(), {
      id: row.id,
      cartId: row.cart_id,
      productId: row.product_id,
      variantId: row.variant_id,
      quantity: row.quantity,
      product,
      variant,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }

  private mapProduct(row: RawProductRow): Product {
    return Object.assign(new Product(), {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      sku: row.sku ?? undefined,
      unitPrice: Number(row.unit_price),
      originalPrice:
        row.original_price === null ? undefined : Number(row.original_price),
      thumbnailUrl: row.thumbnail_url ?? undefined,
      images: Array.isArray(row.images) ? row.images : [],
      isActive: row.is_active,
      categoryId: row.category_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }

  private mapVariant(row: RawVariantRow): ProductVariant {
    return Object.assign(new ProductVariant(), {
      id: row.id,
      productId: row.product_id,
      parentId: row.parent_id,
      name: row.name,
      value: row.value,
      sku: row.sku,
      unitPrice: row.unit_price === null ? null : Number(row.unit_price),
      stock: row.stock,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }

  private mapInventory(row: RawInventoryRow): Inventory {
    return Object.assign(new Inventory(), {
      id: row.id,
      productId: row.product_id,
      stock: row.stock,
      reservedStock: row.reserved_stock,
      lowStockThreshold: row.low_stock_threshold,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }
}
