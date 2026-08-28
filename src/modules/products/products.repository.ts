import { Injectable } from '@nestjs/common';
import { Category, Product, ProductVariant } from '@entities';
import { DataSource, QueryRunner } from 'typeorm';
import { GetAllDto, SortOrder } from 'src/database/dtos/common/get_all.dto';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { createPaginatedData } from '@common/pagination/create_paginated_data';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { extractPostgresRows } from '@common/database/postgres-query-result';

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
  category_name?: string | null;
  category_slug?: string | null;
  category_is_active?: boolean | null;
  inventory_stock?: number | null;
  inventory_reserved_stock?: number | null;
  inventory_low_stock_threshold?: number | null;
  available_stock?: number | string | null;
  total_count?: number | string;
}

export interface StorefrontProductQuery {
  page: number;
  limit: number;
  search?: string;
  categorySlug?: string;
}

export interface StorefrontProduct extends Product {
  inventory: {
    stock: number;
    reservedStock: number;
    lowStockThreshold: number;
  };
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

interface ExistingVariantIdentity {
  id: string;
  parent_id: string | null;
  name: string;
  value: string;
  sku: string | null;
  unit_price: number | string | null;
  stock: number;
  sort_order: number;
  is_active: boolean;
}

interface ExistsRow {
  exists: boolean;
}

interface SkuRow {
  sku: string;
}

export class ProductSkuConflictError extends Error {
  constructor(public readonly skus: string[]) {
    super('SKU sản phẩm hoặc biến thể đã tồn tại');
    this.name = 'ProductSkuConflictError';
  }
}

export class ProductVariantRemovalConflictError extends Error {
  constructor() {
    super(
      'Không thể xóa biến thể còn tồn kho hoặc đang nằm trong đơn chưa xử lý xong',
    );
    this.name = 'ProductVariantRemovalConflictError';
  }
}

@Injectable()
export class ProductsRepository {
  private readonly sortColumns: Record<string, string> = {
    name: 'p.name',
    sku: 'p.sku',
    unitPrice: 'p.unit_price',
    createdAt: 'p.created_at',
    updatedAt: 'p.updated_at',
  };

  constructor(private readonly dataSource: DataSource) {}

  async findStorefrontPaginated(
    query: StorefrontProductQuery,
  ): Promise<PaginatedData<StorefrontProduct>> {
    const parameters: unknown[] = [];
    const conditions = [
      'p.deleted_at IS NULL',
      'p.is_active = TRUE',
      'c.deleted_at IS NULL',
      'c.is_active = TRUE',
    ];
    const addParameter = (value: unknown) => {
      parameters.push(value);
      return `$${parameters.length}`;
    };

    if (query.search) {
      const placeholder = addParameter(`%${query.search}%`);
      conditions.push(
        `(p.name ILIKE ${placeholder} OR p.sku ILIKE ${placeholder} OR c.name ILIKE ${placeholder})`,
      );
    }
    if (query.categorySlug) {
      const placeholder = addParameter(query.categorySlug);
      conditions.push(`p.category_id IN (
        WITH RECURSIVE category_tree AS (
          SELECT id FROM categories
          WHERE slug = ${placeholder} AND is_active = TRUE AND deleted_at IS NULL
          UNION ALL
          SELECT child.id FROM categories child
          INNER JOIN category_tree parent ON child.parent_id = parent.id
          WHERE child.is_active = TRUE AND child.deleted_at IS NULL
        )
        SELECT id FROM category_tree
      )`);
    }

    const limitPlaceholder = addParameter(query.limit);
    const offsetPlaceholder = addParameter((query.page - 1) * query.limit);
    const rows = await this.dataSource.query<RawProductRow[]>(
      `${this.storefrontSelectSql}
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.created_at DESC, p.name ASC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      parameters,
    );
    const products = rows.map((row) => this.mapStorefrontProduct(row));
    await this.attachVariants(products, true);
    return createPaginatedData(
      products,
      Number(rows[0]?.total_count ?? 0),
      query.page,
      query.limit,
    );
  }

  async findStorefrontBySlug(slug: string): Promise<StorefrontProduct | null> {
    const [row] = await this.dataSource.query<RawProductRow[]>(
      `${this.storefrontSelectSql}
       WHERE p.slug = $1
         AND p.deleted_at IS NULL
         AND p.is_active = TRUE
         AND c.deleted_at IS NULL
         AND c.is_active = TRUE
       LIMIT 1`,
      [slug],
    );
    if (!row) return null;
    const product = this.mapStorefrontProduct(row);
    await this.attachVariants([product], true);
    return product;
  }

  async findPaginated(query: GetAllDto): Promise<PaginatedData<Product>> {
    const parameters: unknown[] = [];
    const conditions = ['p.deleted_at IS NULL'];
    const addParameter = (value: unknown) => {
      parameters.push(value);
      return `$${parameters.length}`;
    };

    if (query.search) {
      const placeholder = addParameter(`%${query.search}%`);
      conditions.push(
        `(p.name ILIKE ${placeholder} OR p.sku ILIKE ${placeholder})`,
      );
    }
    if (typeof query.isActive === 'boolean') {
      conditions.push(`p.is_active = ${addParameter(query.isActive)}`);
    }

    const limitPlaceholder = addParameter(query.limit);
    const offsetPlaceholder = addParameter(query.skip);
    const sortColumn = this.sortColumns[query.sortBy] ?? 'p.created_at';
    const sortOrder = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
    const rows = await this.dataSource.query<RawProductRow[]>(
      `SELECT
         p.id, p.name, p.slug, p.description, p.sku, p.unit_price,
         p.original_price, p.thumbnail_url, p.images, p.is_active,
         p.category_id, p.created_at, p.updated_at, p.deleted_at,
         c.name AS category_name, c.slug AS category_slug,
         c.is_active AS category_is_active,
         COALESCE(i.stock, 0) AS inventory_stock,
         GREATEST(COALESCE(
           (
             SELECT SUM(variant.stock)
             FROM product_variants variant
             WHERE variant.product_id = p.id
               AND variant.parent_id IS NOT NULL
               AND variant.is_active = TRUE
               AND variant.deleted_at IS NULL
           ),
           i.stock,
           0
         ) - COALESCE(i.reserved_stock, 0), 0) AS available_stock,
         COUNT(*) OVER() AS total_count
       FROM products p
       LEFT JOIN categories c
         ON c.id = p.category_id AND c.deleted_at IS NULL
       LEFT JOIN inventories i
         ON i.product_id = p.id AND i.deleted_at IS NULL
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      parameters,
    );
    const items = rows.map((row) => this.mapProduct(row));
    await this.attachVariants(items);
    return createPaginatedData(
      items,
      Number(rows[0]?.total_count ?? 0),
      query.page,
      query.limit,
    );
  }

  create(data: Partial<Product>): Product {
    return Object.assign(new Product(), data);
  }

  async save(product: Product, actorId?: string): Promise<Product> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId });
      const row = await this.upsertProduct(product, async (sql, parameters) => {
        const result: unknown = await queryRunner.query(sql, parameters);
        return extractPostgresRows<RawProductRow>(result);
      });
      await queryRunner.commitTransaction();
      const saved = await this.findById(row.id);
      if (!saved) throw new Error('Không thể lưu sản phẩm');
      return saved;
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async saveWithVariants(
    product: Product,
    variants: ProductVariantGroupInput[],
    inventoryStock: number,
    actorId?: string,
  ): Promise<Product> {
    return this.persistWithVariants(
      product,
      variants,
      inventoryStock,
      false,
      actorId,
    );
  }

  async updateWithVariants(
    product: Product,
    variants: ProductVariantGroupInput[],
    actorId?: string,
  ): Promise<Product> {
    return this.persistWithVariants(product, variants, 0, true, actorId);
  }

  private async persistWithVariants(
    product: Product,
    variants: ProductVariantGroupInput[],
    inventoryStock: number,
    preserveExistingStock: boolean,
    actorId?: string,
  ): Promise<Product> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId });
      await this.lockAndAssertSkus(
        queryRunner,
        product.sku,
        variants.flatMap((group) => group.children.map((child) => child.sku)),
        product.id,
      );
      const savedProduct = await this.upsertProduct(
        product,
        async (sql, parameters) => {
          const rawRows: unknown = await queryRunner.query(sql, parameters);
          return extractPostgresRows<RawProductRow>(rawRows);
        },
      );
      const existingVariants = (await queryRunner.query(
        `SELECT id, parent_id, name, value, sku, unit_price, stock,
                sort_order, is_active
         FROM product_variants
         WHERE product_id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [savedProduct.id],
      )) as unknown as ExistingVariantIdentity[];
      const existingById = new Map(
        existingVariants.map((variant) => [variant.id, variant]),
      );
      const retainedIds = new Set<string>();

      for (const [groupIndex, group] of variants.entries()) {
        let parentId = group.id;
        if (parentId) {
          const existing = existingById.get(parentId);
          if (!existing || existing.parent_id !== null) {
            throw new Error('Nhóm biến thể không thuộc sản phẩm này');
          }
          this.assertVariantIdNotUsed(retainedIds, parentId);
          if (
            existing.name !== group.name ||
            existing.value !== group.value ||
            existing.sort_order !== groupIndex ||
            !existing.is_active
          ) {
            await queryRunner.query(
              `UPDATE product_variants
               SET name = $3, value = $4, sort_order = $5, is_active = TRUE,
                   deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1 AND product_id = $2 AND parent_id IS NULL`,
              [parentId, savedProduct.id, group.name, group.value, groupIndex],
            );
          }
        } else {
          const parentRows = (await queryRunner.query(
            `INSERT INTO product_variants
             (product_id, parent_id, name, value, stock, sort_order, is_active)
             VALUES ($1, NULL, $2, $3, 0, $4, TRUE)
             RETURNING id, product_id, parent_id, name, value, sku, unit_price,
                       stock, sort_order, is_active, created_at, updated_at,
                       deleted_at`,
            [savedProduct.id, group.name, group.value, groupIndex],
          )) as unknown as RawVariantRow[];
          parentId = parentRows[0]?.id;
          if (!parentId) throw new Error('Không thể tạo nhóm biến thể');
          this.assertVariantIdNotUsed(retainedIds, parentId);
        }

        for (const [childIndex, child] of group.children.entries()) {
          if (child.id) {
            const existing = existingById.get(child.id);
            if (!existing || existing.parent_id === null) {
              throw new Error('Biến thể con không thuộc sản phẩm này');
            }
            this.assertVariantIdNotUsed(retainedIds, child.id);
            if (
              existing.parent_id !== parentId ||
              existing.name !== child.name ||
              existing.value !== child.value ||
              existing.sku !== child.sku ||
              Number(existing.unit_price) !== child.unitPrice ||
              (!preserveExistingStock && existing.stock !== child.stock) ||
              existing.sort_order !== childIndex ||
              !existing.is_active
            ) {
              await queryRunner.query(
                `UPDATE product_variants
                 SET parent_id = $3, name = $4, value = $5, sku = $6,
                     unit_price = $7,
                     stock = CASE WHEN $10 THEN stock ELSE $8 END,
                     sort_order = $9,
                     is_active = TRUE, deleted_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND product_id = $2 AND parent_id IS NOT NULL`,
                [
                  child.id,
                  savedProduct.id,
                  parentId,
                  child.name,
                  child.value,
                  this.normalizeSku(child.sku),
                  child.unitPrice,
                  child.stock,
                  childIndex,
                  preserveExistingStock,
                ],
              );
            }
          } else {
            const inserted = (await queryRunner.query(
              `INSERT INTO product_variants
               (product_id, parent_id, name, value, sku, unit_price, stock,
                sort_order, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
               RETURNING id`,
              [
                savedProduct.id,
                parentId,
                child.name,
                child.value,
                this.normalizeSku(child.sku),
                child.unitPrice,
                preserveExistingStock ? 0 : child.stock,
                childIndex,
              ],
            )) as unknown as { id: string }[];
            const childId = inserted[0]?.id;
            if (!childId) throw new Error('Không thể tạo biến thể con');
            this.assertVariantIdNotUsed(retainedIds, childId);
          }
        }
      }

      const removedIds = existingVariants
        .filter((variant) => !retainedIds.has(variant.id))
        .map((variant) => variant.id);
      if (removedIds.length > 0) {
        const [blockedVariant] = (await queryRunner.query(
          `SELECT variant.id
           FROM product_variants variant
           WHERE variant.id = ANY($1::uuid[])
             AND (
               variant.stock <> 0
               OR EXISTS (
                 SELECT 1 FROM order_items item
                 INNER JOIN orders order_row ON order_row.id = item.order_id
                 WHERE item.variant_id = variant.id
                   AND item.deleted_at IS NULL
                   AND order_row.deleted_at IS NULL
                   AND order_row.status IN (
                     'pending', 'confirmed', 'processing', 'shipping'
                   )
               )
             )
           LIMIT 1`,
          [removedIds],
        )) as unknown as { id: string }[];
        if (blockedVariant) throw new ProductVariantRemovalConflictError();
        await queryRunner.query(
          `UPDATE product_variants
           SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE product_id = $1 AND id = ANY($2::uuid[])
             AND deleted_at IS NULL`,
          [savedProduct.id, removedIds],
        );
      }

      let resolvedInventoryStock = inventoryStock;
      if (preserveExistingStock) {
        const [inventoryRow] = (await queryRunner.query(
          `SELECT id, stock FROM inventories
           WHERE product_id = $1 AND deleted_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [savedProduct.id],
        )) as unknown as { id: string; stock: number }[];
        const [stockRow] = (await queryRunner.query(
          `SELECT COUNT(v.id) AS leaf_count,
                  COALESCE(SUM(v.stock), 0) AS variant_stock
           FROM product_variants v
           WHERE v.product_id = $1
             AND v.deleted_at IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM product_variants child
               WHERE child.parent_id = v.id AND child.deleted_at IS NULL
             )`,
          [savedProduct.id],
        )) as unknown as {
          leaf_count: string | number;
          variant_stock: string | number;
        }[];
        resolvedInventoryStock =
          Number(stockRow?.leaf_count ?? 0) > 0
            ? Number(stockRow.variant_stock)
            : Number(inventoryRow?.stock ?? 0);
      }

      await queryRunner.query(
        `INSERT INTO inventories
           (product_id, stock, reserved_stock, low_stock_threshold)
         VALUES ($1, $2, 0, 10)
         ON CONFLICT (product_id) DO UPDATE
         SET stock = EXCLUDED.stock,
             deleted_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE inventories.stock IS DISTINCT FROM EXCLUDED.stock
            OR inventories.deleted_at IS NOT NULL`,
        [savedProduct.id, resolvedInventoryStock],
      );

      await queryRunner.commitTransaction();
      const saved = await this.findById(savedProduct.id);
      if (!saved) throw new Error('Không thể tải lại sản phẩm');
      return saved;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<Product | null> {
    const [row] = await this.dataSource.query<RawProductRow[]>(
      `SELECT
         p.id, p.name, p.slug, p.description, p.sku, p.unit_price,
         p.original_price, p.thumbnail_url, p.images, p.is_active,
         p.category_id, p.created_at, p.updated_at, p.deleted_at,
         c.name AS category_name, c.slug AS category_slug,
         c.is_active AS category_is_active,
         COALESCE(i.stock, 0) AS inventory_stock,
         GREATEST(COALESCE(
           (
             SELECT SUM(variant.stock)
             FROM product_variants variant
             WHERE variant.product_id = p.id
               AND variant.parent_id IS NOT NULL
               AND variant.is_active = TRUE
               AND variant.deleted_at IS NULL
           ),
           i.stock,
           0
         ) - COALESCE(i.reserved_stock, 0), 0) AS available_stock
       FROM products p
       LEFT JOIN categories c
         ON c.id = p.category_id AND c.deleted_at IS NULL
       LEFT JOIN inventories i
         ON i.product_id = p.id AND i.deleted_at IS NULL
       WHERE p.id = $1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!row) return null;
    const product = this.mapProduct(row);
    await this.attachVariants([product]);
    return product;
  }

  async categoryExists(id: string): Promise<boolean> {
    const [row] = await this.dataSource.query<ExistsRow[]>(
      `SELECT EXISTS(
         SELECT 1 FROM categories
         WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL
       ) AS "exists"`,
      [id],
    );
    return row?.exists ?? false;
  }

  async productSkuExists(
    sku: string,
    excludeProductId?: string,
  ): Promise<boolean> {
    const parameters: unknown[] = [sku];
    let excludeCondition = '';
    if (excludeProductId) {
      parameters.push(excludeProductId);
      excludeCondition = ' AND id <> $2';
    }
    const [row] = await this.dataSource.query<ExistsRow[]>(
      `SELECT EXISTS(
         SELECT 1 FROM products
         WHERE LOWER(sku) = LOWER($1)
           AND deleted_at IS NULL
           ${excludeCondition}
       ) AS "exists"`,
      parameters,
    );
    return row?.exists ?? false;
  }

  variantSkusExisting(
    skus: string[],
    excludeProductId?: string,
  ): Promise<string[]> {
    return this.findExistingSkus('product_variants', skus, excludeProductId);
  }

  productSkusExisting(
    skus: string[],
    excludeProductId?: string,
  ): Promise<string[]> {
    return this.findExistingSkus('products', skus, excludeProductId);
  }

  private async findExistingSkus(
    table: 'products' | 'product_variants',
    skus: string[],
    excludeProductId?: string,
  ): Promise<string[]> {
    if (skus.length === 0) return [];
    const normalized = skus.map((sku) => sku.toLowerCase());
    const parameters: unknown[] = [normalized];
    let excludeCondition = '';
    if (excludeProductId) {
      parameters.push(excludeProductId);
      const idColumn = table === 'products' ? 'id' : 'product_id';
      excludeCondition = ` AND ${idColumn} <> $2`;
    }
    const rows = await this.dataSource.query<SkuRow[]>(
      `SELECT LOWER(sku) AS sku
       FROM ${table}
       WHERE LOWER(sku) = ANY($1::text[])
         AND deleted_at IS NULL
         ${excludeCondition}`,
      parameters,
    );
    return rows.map((row) => row.sku);
  }

  private async attachVariants(
    products: Product[],
    activeOnly = false,
  ): Promise<void> {
    const productIds = products.flatMap((product) =>
      product.id ? [product.id] : [],
    );
    if (productIds.length === 0) return;
    const rows = await this.dataSource.query<RawVariantRow[]>(
      `SELECT id, product_id, parent_id, name, value, sku, unit_price,
              stock, sort_order, is_active, created_at, updated_at, deleted_at
       FROM product_variants
       WHERE product_id = ANY($1::uuid[])
         AND deleted_at IS NULL
         ${activeOnly ? 'AND is_active = TRUE' : ''}
       ORDER BY sort_order ASC, created_at ASC`,
      [productIds],
    );
    const variants = rows.map((row) => this.mapVariant(row));
    for (const product of products) {
      const productVariants = variants.filter(
        (variant) => variant.productId === product.id,
      );
      const parents = productVariants.filter((variant) => !variant.parentId);
      for (const parent of parents) {
        parent.children = productVariants.filter(
          (variant) => variant.parentId === parent.id,
        );
      }
      product.variants = parents;
    }
  }

  private async upsertProduct(
    product: Product,
    query: (sql: string, parameters: unknown[]) => Promise<RawProductRow[]>,
  ): Promise<RawProductRow> {
    const categoryId = product.category?.id ?? product.categoryId ?? null;
    const values = [
      product.name,
      product.slug,
      product.description ?? null,
      product.sku ? this.normalizeSku(product.sku) : null,
      product.unitPrice ?? 0,
      product.originalPrice ?? null,
      product.thumbnailUrl ?? null,
      JSON.stringify(product.images ?? []),
      product.isActive ?? true,
      categoryId,
    ];

    const rows = product.id
      ? await query(
          `UPDATE products
           SET name = $2, slug = $3, description = $4, sku = $5,
               unit_price = $6, original_price = $7, thumbnail_url = $8,
               images = $9::jsonb, is_active = $10, category_id = $11,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING id, name, slug, description, sku, unit_price,
                     original_price, thumbnail_url, images, is_active,
                     category_id, created_at, updated_at, deleted_at`,
          [product.id, ...values],
        )
      : await query(
          `INSERT INTO products
             (name, slug, description, sku, unit_price, original_price,
              thumbnail_url, images, is_active, category_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
           RETURNING id, name, slug, description, sku, unit_price,
                     original_price, thumbnail_url, images, is_active,
                     category_id, created_at, updated_at, deleted_at`,
          values,
        );
    const row = rows[0];
    if (!row) throw new Error('Không thể lưu sản phẩm');
    return row;
  }

  private mapProduct(row: RawProductRow): Product {
    const category = row.category_id
      ? Object.assign(new Category(), {
          id: row.category_id,
          name: row.category_name ?? undefined,
          slug: row.category_slug ?? undefined,
          isActive: row.category_is_active ?? undefined,
        })
      : undefined;
    const images = Array.isArray(row.images)
      ? row.images.filter((image): image is string => typeof image === 'string')
      : [];
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
      images,
      isActive: row.is_active,
      categoryId: row.category_id ?? undefined,
      category,
      availableStock: Number(row.available_stock ?? 0),
      stock: Number(row.inventory_stock ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }

  private assertVariantIdNotUsed(ids: Set<string>, id: string): void {
    if (ids.has(id))
      throw new Error('ID biến thể bị trùng trong dữ liệu gửi lên');
    ids.add(id);
  }

  private async lockAndAssertSkus(
    queryRunner: QueryRunner,
    productSku: string | undefined,
    variantSkus: string[],
    excludeProductId?: string,
  ): Promise<void> {
    const normalizedSkus = Array.from(
      new Set(
        [productSku, ...variantSkus]
          .filter((sku): sku is string => Boolean(sku?.trim()))
          .map((sku) => this.normalizeSku(sku)),
      ),
    ).sort();
    for (const sku of normalizedSkus) {
      await queryRunner.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`ecommerce:sku:${sku}`],
      );
    }
    if (normalizedSkus.length === 0) return;
    const rows = (await queryRunner.query(
      `SELECT sku FROM products
       WHERE UPPER(sku) = ANY($1::text[])
         AND deleted_at IS NULL
         AND ($2::uuid IS NULL OR id <> $2)
       UNION ALL
       SELECT sku FROM product_variants
       WHERE UPPER(sku) = ANY($1::text[])
         AND deleted_at IS NULL
         AND ($2::uuid IS NULL OR product_id <> $2)`,
      [normalizedSkus, excludeProductId ?? null],
    )) as unknown as SkuRow[];
    if (rows.length > 0) {
      throw new ProductSkuConflictError(
        rows.map((row) => this.normalizeSku(row.sku)),
      );
    }
  }

  private normalizeSku(sku: string): string {
    return sku.trim().toUpperCase();
  }

  private mapStorefrontProduct(row: RawProductRow): StorefrontProduct {
    const stock = Number(row.inventory_stock ?? 0);
    const reservedStock = Number(row.inventory_reserved_stock ?? 0);
    return Object.assign(this.mapProduct(row), {
      availableStock: Math.max(stock - reservedStock, 0),
      inventory: {
        stock,
        reservedStock,
        lowStockThreshold: Number(row.inventory_low_stock_threshold ?? 0),
      },
    });
  }

  private readonly storefrontSelectSql = `SELECT
     p.id, p.name, p.slug, p.description, p.sku, p.unit_price,
     p.original_price, p.thumbnail_url, p.images, p.is_active,
     p.category_id, p.created_at, p.updated_at, p.deleted_at,
     c.name AS category_name, c.slug AS category_slug,
     c.is_active AS category_is_active,
     COALESCE(
       (
         SELECT SUM(variant.stock)
         FROM product_variants variant
         WHERE variant.product_id = p.id
           AND variant.parent_id IS NOT NULL
           AND variant.is_active = TRUE
           AND variant.deleted_at IS NULL
       ),
       i.stock,
       0
     ) AS inventory_stock,
     i.reserved_stock AS inventory_reserved_stock,
     i.low_stock_threshold AS inventory_low_stock_threshold,
     COUNT(*) OVER() AS total_count
   FROM products p
   INNER JOIN categories c ON c.id = p.category_id
   LEFT JOIN inventories i
     ON i.product_id = p.id AND i.deleted_at IS NULL`;

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
}

export interface ProductVariantGroupInput {
  id?: string;
  name: string;
  value: string;
  children: Array<{
    id?: string;
    name: string;
    value: string;
    sku: string;
    unitPrice: number;
    stock: number;
  }>;
}
