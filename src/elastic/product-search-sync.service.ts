import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ElasticProductSearchService } from './elastic-product-search.service.js';

@Injectable()
export class ProductSearchSyncService {
  private readonly logger = new Logger(ProductSearchSyncService.name);

  constructor(private readonly search: ElasticProductSearchService) {}

  /** Ghi outbox trong transaction PostgreSQL cùng với thay đổi sản phẩm. */
  async enqueueProductChanged(
    manager: EntityManager,
    productId: string,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO product_search_outbox (product_id) VALUES ($1)`,
      [productId],
    );
  }

  /** Đổi tên/trạng thái shop làm thay đổi tài liệu của mọi sản phẩm trong shop. */
  async enqueueShopProductsChanged(
    manager: EntityManager,
    shopId: string,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO product_search_outbox (product_id)
       SELECT id FROM products WHERE shop_id = $1`,
      [shopId],
    );
  }

  /** Đồng bộ sau commit để request thấy kết quả ngay; outbox vẫn đảm bảo retry. */
  async syncAfterCommit(productId: string): Promise<void> {
    try {
      await this.search.syncProduct(productId, 'wait_for');
    } catch (error) {
      this.logger.warn(
        `Immediate Elasticsearch sync failed for product ${productId}: ${(error as Error).message}`,
      );
    }
  }
}
