import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { InventoryTransactionType } from '@entities';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';

export type InventoryUpdateErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'INVENTORY_NOT_FOUND'
  | 'VARIANT_REQUIRED'
  | 'VARIANT_NOT_ALLOWED'
  | 'VARIANT_NOT_FOUND'
  | 'STALE_STOCK'
  | 'UNCHANGED_STOCK'
  | 'STOCK_BELOW_RESERVED';

export class InventoryUpdateError extends Error {
  constructor(
    public readonly code: InventoryUpdateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'InventoryUpdateError';
  }
}

export interface InventoryVariantView {
  id: string;
  parentId: string | null;
  name: string;
  value: string;
  parentName: string | null;
  parentValue: string | null;
  sku: string | null;
  stock: number;
  isActive: boolean;
}

export interface InventoryProductView {
  id: string;
  name: string;
  sku: string | null;
  thumbnailUrl: string | null;
  categoryId: string;
  categoryName: string;
  stock: number;
  reservedStock: number;
  availableStock: number;
  hasVariants: boolean;
  variants: InventoryVariantView[];
  updatedAt: Date;
}

export interface InventoryLogView {
  id: string;
  productId: string;
  variantId: string | null;
  variantName: string | null;
  variantValue: string | null;
  variantSku: string | null;
  type: InventoryTransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: Date;
}

export interface UpdateStockInput {
  variantId?: string;
  stock: number;
  expectedStock: number;
  reason: string;
  actorId: string;
}

interface CountRow {
  count: string | number;
}

interface RawInventoryProduct {
  id: string;
  name: string;
  sku: string | null;
  thumbnail_url: string | null;
  category_id: string;
  category_name: string;
  stock: number;
  reserved_stock: number;
  updated_at: Date;
  variants: InventoryVariantView[] | string | null;
}

@Injectable()
export class InventoriesRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findAll(
    query: InventoryQueryDto,
  ): Promise<PaginatedData<InventoryProductView>> {
    const parameters: unknown[] = [query.categoryId];
    const conditions = [
      'p.deleted_at IS NULL',
      'p.category_id IN (SELECT id FROM category_tree)',
    ];
    if (query.search) {
      parameters.push(`%${query.search}%`);
      conditions.push(
        `(p.name ILIKE $${parameters.length} OR p.sku ILIKE $${parameters.length})`,
      );
    }
    const where = conditions.join(' AND ');
    const categoryCte = `WITH RECURSIVE category_tree AS (
      SELECT id FROM categories WHERE id = $1 AND deleted_at IS NULL
      UNION ALL
      SELECT c.id FROM categories c
      INNER JOIN category_tree parent ON c.parent_id = parent.id
      WHERE c.deleted_at IS NULL
    )`;
    const [{ count = 0 } = {}] = (await this.dataSource.query(
      `${categoryCte}
       SELECT COUNT(*) AS count FROM products p WHERE ${where}`,
      parameters,
    )) as unknown as CountRow[];
    const totalItems = Number(count);
    const sortColumns: Record<string, string> = {
      createdAt: 'p.created_at',
      updatedAt: 'i.updated_at',
      name: 'p.name',
      stock: 'i.stock',
    };
    const sortColumn = sortColumns[query.sortBy] ?? sortColumns.name;
    parameters.push(query.limit, query.skip);
    const rows = (await this.dataSource.query(
      `${categoryCte}
       SELECT p.id, p.name, p.sku, p.thumbnail_url, p.category_id,
              c.name AS category_name, COALESCE(i.stock, 0) AS stock,
              COALESCE(i.reserved_stock, 0) AS reserved_stock,
              COALESCE(i.updated_at, p.updated_at) AS updated_at,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', v.id, 'parentId', v.parent_id, 'name', v.name,
                  'value', v.value, 'parentName', parent.name,
                  'parentValue', parent.value, 'sku', v.sku,
                  'stock', v.stock, 'isActive', v.is_active
                ) ORDER BY COALESCE(parent.sort_order, 0), v.sort_order, v.value)
                FROM product_variants v
                LEFT JOIN product_variants parent ON parent.id = v.parent_id
                WHERE v.product_id = p.id AND v.deleted_at IS NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM product_variants child
                    WHERE child.parent_id = v.id AND child.deleted_at IS NULL
                  )
              ), '[]'::json) AS variants
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventories i ON i.product_id = p.id AND i.deleted_at IS NULL
       WHERE ${where}
       ORDER BY ${sortColumn} ${query.sortOrder}
       LIMIT $${parameters.length - 1} OFFSET $${parameters.length}`,
      parameters,
    )) as unknown as RawInventoryProduct[];
    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);
    return {
      items: rows.map((row) => this.mapProduct(row)),
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

  async updateStock(
    productId: string,
    input: UpdateStockInput,
  ): Promise<InventoryProductView> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, {
        actorId: input.actorId,
        inventoryReason: input.reason,
        inventoryType: 'adjustment',
      });
      const [product] = (await queryRunner.query(
        `SELECT p.id, p.name
         FROM products p
         WHERE p.id = $1 AND p.deleted_at IS NULL
         LIMIT 1 FOR UPDATE OF p`,
        [productId],
      )) as unknown as {
        id: string;
        name: string;
      }[];
      if (!product) {
        throw new InventoryUpdateError(
          'PRODUCT_NOT_FOUND',
          'Không tìm thấy sản phẩm hoặc tồn kho!',
        );
      }
      const [{ count = 0 } = {}] = (await queryRunner.query(
        `SELECT COUNT(*) AS count FROM product_variants
         WHERE product_id = $1 AND deleted_at IS NULL`,
        [productId],
      )) as unknown as CountRow[];
      const hasVariants = Number(count) > 0;
      if (hasVariants && !input.variantId) {
        throw new InventoryUpdateError(
          'VARIANT_REQUIRED',
          'Sản phẩm này phải cập nhật tồn kho theo từng biến thể!',
        );
      }
      if (!hasVariants && input.variantId) {
        throw new InventoryUpdateError(
          'VARIANT_NOT_ALLOWED',
          'Sản phẩm này không có biến thể!',
        );
      }

      if (input.variantId) {
        await this.updateVariantStock(queryRunner, product, input);
      } else {
        const inventory = await this.lockInventory(queryRunner, product.id);
        await this.updateSimpleProductStock(queryRunner, inventory, input);
      }
      await queryRunner.commitTransaction();
      const saved = await this.findProductById(productId);
      if (!saved)
        throw new InventoryUpdateError(
          'PRODUCT_NOT_FOUND',
          'Không tìm thấy sản phẩm!',
        );
      return saved;
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findLogs(
    productId: string,
    limit: number,
    variantId?: string,
  ): Promise<InventoryLogView[]> {
    const parameters: unknown[] = [productId];
    const variantCondition = variantId ? `AND transaction.variant_id = $2` : '';
    if (variantId) parameters.push(variantId);
    parameters.push(limit);
    const rows = (await this.dataSource.query(
      `SELECT transaction.id, inventory.product_id, transaction.variant_id,
              variant.name AS variant_name, variant.value AS variant_value,
              variant.sku AS variant_sku, transaction.type,
              transaction.quantity, transaction.previous_stock,
              transaction.new_stock, transaction.reason, transaction.actor_id,
              actor.full_name AS actor_name, actor.email AS actor_email,
              transaction.created_at
       FROM inventory_transactions transaction
       INNER JOIN inventories inventory ON inventory.id = transaction.inventory_id
       LEFT JOIN product_variants variant ON variant.id = transaction.variant_id
       LEFT JOIN users actor ON actor.id = transaction.actor_id
       WHERE inventory.product_id = $1 ${variantCondition}
       ORDER BY transaction.created_at DESC
       LIMIT $${parameters.length}`,
      parameters,
    )) as unknown as {
      id: string;
      product_id: string;
      variant_id: string | null;
      variant_name: string | null;
      variant_value: string | null;
      variant_sku: string | null;
      type: InventoryTransactionType;
      quantity: number;
      previous_stock: number;
      new_stock: number;
      reason: string | null;
      actor_id: string | null;
      actor_name: string | null;
      actor_email: string | null;
      created_at: Date;
    }[];
    return rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id,
      variantName: row.variant_name,
      variantValue: row.variant_value,
      variantSku: row.variant_sku,
      type: row.type,
      quantity: row.quantity,
      previousStock: row.previous_stock,
      newStock: row.new_stock,
      reason: row.reason,
      actorId: row.actor_id,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      createdAt: row.created_at,
    }));
  }

  private async updateVariantStock(
    queryRunner: QueryRunner,
    product: { id: string },
    input: UpdateStockInput,
  ): Promise<void> {
    const [variant] = (await queryRunner.query(
      `SELECT v.id, v.stock FROM product_variants v
       WHERE v.id = $1 AND v.product_id = $2 AND v.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM product_variants child
                         WHERE child.parent_id = v.id AND child.deleted_at IS NULL)
       LIMIT 1 FOR UPDATE OF v`,
      [input.variantId, product.id],
    )) as unknown as { id: string; stock: number }[];
    if (!variant)
      throw new InventoryUpdateError(
        'VARIANT_NOT_FOUND',
        'Không tìm thấy biến thể cuối của sản phẩm!',
      );
    this.assertExpectedStock(variant.stock, input);
    const inventory = await this.lockInventory(queryRunner, product.id);
    await queryRunner.query(
      `UPDATE product_variants SET stock = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [variant.id, input.stock],
    );
    const [{ total = 0 } = {}] = (await queryRunner.query(
      `SELECT COALESCE(SUM(v.stock), 0) AS total
       FROM product_variants v
       WHERE v.product_id = $1 AND v.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM product_variants child
                         WHERE child.parent_id = v.id AND child.deleted_at IS NULL)`,
      [product.id],
    )) as unknown as { total: string | number }[];
    await queryRunner.query(
      `UPDATE inventories SET stock = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [inventory.id, Number(total)],
    );
  }

  private async updateSimpleProductStock(
    queryRunner: QueryRunner,
    inventory: { id: string; stock: number; reservedStock: number },
    input: UpdateStockInput,
  ): Promise<void> {
    this.assertExpectedStock(inventory.stock, input);
    if (input.stock < inventory.reservedStock) {
      throw new InventoryUpdateError(
        'STOCK_BELOW_RESERVED',
        `Số lượng không được nhỏ hơn số lượng đang giữ chỗ (${inventory.reservedStock})!`,
      );
    }
    await queryRunner.query(
      `UPDATE inventories SET stock = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [inventory.id, input.stock],
    );
  }

  private async lockInventory(
    queryRunner: QueryRunner,
    productId: string,
  ): Promise<{ id: string; stock: number; reservedStock: number }> {
    const [row] = (await queryRunner.query(
      `SELECT id, stock, reserved_stock
       FROM inventories
       WHERE product_id = $1 AND deleted_at IS NULL
       LIMIT 1 FOR UPDATE`,
      [productId],
    )) as unknown as { id: string; stock: number; reserved_stock: number }[];
    if (!row) {
      throw new InventoryUpdateError(
        'INVENTORY_NOT_FOUND',
        'Sản phẩm chưa được thiết lập tồn kho!',
      );
    }
    return {
      id: row.id,
      stock: row.stock,
      reservedStock: row.reserved_stock,
    };
  }

  private assertExpectedStock(
    currentStock: number,
    input: UpdateStockInput,
  ): void {
    if (currentStock !== input.expectedStock) {
      throw new InventoryUpdateError(
        'STALE_STOCK',
        `Tồn kho đã thay đổi từ ${input.expectedStock} thành ${currentStock}. Vui lòng tải lại dữ liệu!`,
      );
    }
    if (currentStock === input.stock) {
      throw new InventoryUpdateError(
        'UNCHANGED_STOCK',
        'Số lượng mới không thay đổi!',
      );
    }
  }

  private async findProductById(
    productId: string,
  ): Promise<InventoryProductView | null> {
    const rows = (await this.dataSource.query(
      `SELECT p.id, p.name, p.sku, p.thumbnail_url, p.category_id,
              c.name AS category_name, i.stock, i.reserved_stock, i.updated_at,
              COALESCE((SELECT json_agg(json_build_object(
                'id', v.id, 'parentId', v.parent_id, 'name', v.name,
                'value', v.value, 'parentName', parent.name,
                'parentValue', parent.value, 'sku', v.sku,
                'stock', v.stock, 'isActive', v.is_active
              ) ORDER BY COALESCE(parent.sort_order, 0), v.sort_order, v.value)
              FROM product_variants v
              LEFT JOIN product_variants parent ON parent.id = v.parent_id
              WHERE v.product_id = p.id AND v.deleted_at IS NULL
                AND NOT EXISTS (SELECT 1 FROM product_variants child
                                WHERE child.parent_id = v.id AND child.deleted_at IS NULL)),
              '[]'::json) AS variants
       FROM products p INNER JOIN categories c ON c.id = p.category_id
       INNER JOIN inventories i ON i.product_id = p.id AND i.deleted_at IS NULL
       WHERE p.id = $1 AND p.deleted_at IS NULL LIMIT 1`,
      [productId],
    )) as unknown as RawInventoryProduct[];
    return rows[0] ? this.mapProduct(rows[0]) : null;
  }

  private mapProduct(row: RawInventoryProduct): InventoryProductView {
    const variants =
      typeof row.variants === 'string'
        ? (JSON.parse(row.variants) as InventoryVariantView[])
        : (row.variants ?? []);
    const stock = Number(row.stock);
    const reservedStock = Number(row.reserved_stock);
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      thumbnailUrl: row.thumbnail_url,
      categoryId: row.category_id,
      categoryName: row.category_name,
      stock,
      reservedStock,
      availableStock: Math.max(stock - reservedStock, 0),
      hasVariants: variants.length > 0,
      variants: variants.map((variant) => ({
        ...variant,
        stock: Number(variant.stock),
      })),
      updatedAt: row.updated_at,
    };
  }
}
