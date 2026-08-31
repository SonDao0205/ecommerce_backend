import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ManagementReviewQueryDto,
  ProductReviewQueryDto,
} from './dto/review-query.dto';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';

export interface ReviewView {
  id: string;
  orderItemId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string | null;
  variantValue: string | null;
  variantSku: string | null;
  userId: string;
  userName: string;
  rating: number;
  content: string;
  media: Array<{
    url: string;
    publicId: string;
    resourceType: 'image' | 'video';
  }>;
  adminReply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type PublicReviewView = Omit<ReviewView, 'orderItemId' | 'userId'>;
export interface ProductReviewPage extends PaginatedData<PublicReviewView> {
  summary: { averageRating: number; reviewCount: number };
}

interface ReviewRow {
  id: string;
  order_item_id: string;
  product_id: string;
  product_slug: string;
  product_name: string;
  variant_name: string | null;
  variant_value: string | null;
  variant_sku: string | null;
  user_id: string;
  user_name: string | null;
  rating: number;
  content: string;
  media: ReviewView['media'];
  admin_reply: string | null;
  replied_at: Date | null;
  created_at: Date;
  updated_at: Date;
  total_count?: string | number;
  average_rating?: string | number;
  review_count?: string | number;
}

@Injectable()
export class ReviewsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async create(userId: string, dto: CreateReviewDto): Promise<ReviewView> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await setDatabaseAuditContext(runner, { actorId: userId });
      const [item] = (await runner.query(
        `SELECT oi.id, oi.product_id, oi.product_name, oi.variant_name, oi.variant_value, oi.variant_sku
         FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id
         WHERE oi.id = $1 AND o.user_id = $2 AND o.status = 'completed'
           AND oi.deleted_at IS NULL AND o.deleted_at IS NULL LIMIT 1 FOR UPDATE OF oi`,
        [dto.orderItemId, userId],
      )) as unknown as Array<{
        id: string;
        product_id: string | null;
        product_name: string;
        variant_name: string | null;
        variant_value: string | null;
        variant_sku: string | null;
      }>;
      if (!item)
        throw new ReviewCreationError(
          'NOT_ELIGIBLE',
          'Chỉ có thể đánh giá sản phẩm thuộc đơn hàng đã hoàn thành!',
        );
      if (!item.product_id)
        throw new ReviewCreationError(
          'PRODUCT_REMOVED',
          'Sản phẩm không còn tồn tại để đánh giá!',
        );
      const [created] = (await runner.query(
        `INSERT INTO product_reviews (order_item_id, product_id, user_id, rating, content, media, product_name, variant_name, variant_value, variant_sku)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10) RETURNING id`,
        [
          item.id,
          item.product_id,
          userId,
          dto.rating,
          dto.content.trim(),
          JSON.stringify(dto.media),
          item.product_name,
          item.variant_name,
          item.variant_value,
          item.variant_sku,
        ],
      )) as unknown as Array<{ id: string }>;
      await runner.commitTransaction();
      return (await this.findById(created.id))!;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async findProductReviews(
    slug: string,
    query: ProductReviewQueryDto,
  ): Promise<ProductReviewPage | null> {
    const [product] = await this.dataSource.query<Array<{ id: string }>>(
      `SELECT id FROM products WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
      [slug],
    );
    if (!product) return null;
    const [summary] = await this.dataSource.query<
      Array<{ average_rating: string | number; review_count: string | number }>
    >(
      `SELECT COALESCE(AVG(rating),0) AS average_rating, COUNT(*) AS review_count FROM product_reviews WHERE product_id = $1 AND deleted_at IS NULL`,
      [product.id],
    );
    const rows = await this.dataSource.query<ReviewRow[]>(
      `${this.selectSql} WHERE r.product_id = $1 AND r.deleted_at IS NULL ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
      [product.id, query.limit, query.skip],
    );
    const totalItems = Number(summary?.review_count ?? 0);
    const totalPages = totalItems ? Math.ceil(totalItems / query.limit) : 0;
    return {
      items: rows.map((row) => this.toPublic(this.map(row))),
      summary: {
        averageRating: Number(Number(summary?.average_rating ?? 0).toFixed(1)),
        reviewCount: totalItems,
      },
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

  async findManagement(
    query: ManagementReviewQueryDto,
  ): Promise<PaginatedData<ReviewView>> {
    const params: unknown[] = [];
    const conditions = ['r.deleted_at IS NULL'];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (query.search) {
      const p = add(`%${query.search}%`);
      conditions.push(
        `(r.product_name ILIKE ${p} OR r.content ILIKE ${p} OR u.full_name ILIKE ${p})`,
      );
    }
    if (typeof query.replied === 'boolean')
      conditions.push(
        query.replied ? 'r.admin_reply IS NOT NULL' : 'r.admin_reply IS NULL',
      );
    const [count] = await this.dataSource.query<Array<{ count: string }>>(
      `SELECT COUNT(*) AS count FROM product_reviews r LEFT JOIN users u ON u.id=r.user_id WHERE ${conditions.join(' AND ')}`,
      params,
    );
    const totalItems = Number(count?.count ?? 0);
    const limit = add(query.limit);
    const offset = add(query.skip);
    const rows = await this.dataSource.query<ReviewRow[]>(
      `${this.selectSql} WHERE ${conditions.join(' AND ')} ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const totalPages = totalItems ? Math.ceil(totalItems / query.limit) : 0;
    return {
      items: rows.map((row) => this.map(row)),
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

  async reply(
    id: string,
    reply: string,
    actorId: string,
  ): Promise<ReviewView | null> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await setDatabaseAuditContext(runner, { actorId });
      const result = (await runner.query(
        `UPDATE product_reviews SET admin_reply=$2, replied_at=CURRENT_TIMESTAMP, replied_by=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
        [id, reply.trim(), actorId],
      )) as unknown as Array<{ id: string }>;
      await runner.commitTransaction();
      return result[0] ? this.findById(id) : null;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async findById(id: string): Promise<ReviewView | null> {
    const [row] = await this.dataSource.query<ReviewRow[]>(
      `${this.selectSql} WHERE r.id=$1 AND r.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return row ? this.map(row) : null;
  }

  private readonly selectSql = `SELECT r.id, r.order_item_id, r.product_id, p.slug AS product_slug, r.product_name,
    r.variant_name, r.variant_value, r.variant_sku, r.user_id, u.full_name AS user_name,
    r.rating, r.content, r.media, r.admin_reply, r.replied_at, r.created_at, r.updated_at
    FROM product_reviews r INNER JOIN products p ON p.id=r.product_id LEFT JOIN users u ON u.id=r.user_id`;
  private map(row: ReviewRow): ReviewView {
    return {
      id: row.id,
      orderItemId: row.order_item_id,
      productId: row.product_id,
      productSlug: row.product_slug,
      productName: row.product_name,
      variantName: row.variant_name,
      variantValue: row.variant_value,
      variantSku: row.variant_sku,
      userId: row.user_id,
      userName: row.user_name || 'Khách hàng',
      rating: Number(row.rating),
      content: row.content,
      media: row.media ?? [],
      adminReply: row.admin_reply,
      repliedAt: row.replied_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toPublic(review: ReviewView): PublicReviewView {
    const publicReview: Partial<ReviewView> = { ...review };
    delete publicReview.orderItemId;
    delete publicReview.userId;
    return publicReview as PublicReviewView;
  }
}

export class ReviewCreationError extends Error {
  constructor(
    public readonly code: 'NOT_ELIGIBLE' | 'PRODUCT_REMOVED',
    message: string,
  ) {
    super(message);
    this.name = 'ReviewCreationError';
  }
}
