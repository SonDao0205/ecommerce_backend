import { Inject, Injectable, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { DataSource } from 'typeorm';
import {
  ELASTICSEARCH_CLIENT,
  PRODUCT_SEARCH_ALIAS,
  PRODUCT_SEARCH_INDEX,
} from './elastic.constants.js';
import type { ProductSearchOptions } from '../product/dto/product-search-options.js';
import { ProductStatus } from '../product/entities/enum/product.enum.js';
import { ShopStatus } from '../shop/entities/enum/shop.enum.js';

export type ProductSearchDocument = {
  id: string;
  name: string;
  price: number;
  sold_count: number;
  image_url: string | null;
  shop_name: string;
  category_id: string;
  shop_id: string;
};

@Injectable()
export class ElasticProductSearchService {
  private readonly logger = new Logger(ElasticProductSearchService.name);
  private ready = false;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    private readonly dataSource: DataSource,
  ) {}

  setReady(ready: boolean): void {
    this.ready = ready;
  }

  async ensureIndex(): Promise<boolean> {
    const exists = await this.client.indices.exists({
      index: PRODUCT_SEARCH_ALIAS,
    });
    if (exists) return false;
    const physicalIndexExists = await this.client.indices.exists({
      index: PRODUCT_SEARCH_INDEX,
    });
    if (physicalIndexExists) {
      await this.client.indices.putAlias({
        index: PRODUCT_SEARCH_INDEX,
        name: PRODUCT_SEARCH_ALIAS,
      });
      return true;
    }
    try {
      await this.client.indices.create({
        index: PRODUCT_SEARCH_INDEX,
        aliases: { [PRODUCT_SEARCH_ALIAS]: {} },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text', analyzer: 'standard' },
            price: { type: 'scaled_float', scaling_factor: 100 },
            sold_count: { type: 'integer' },
            image_url: { type: 'keyword', index: false },
            shop_name: { type: 'keyword', index: false },
            category_id: { type: 'keyword' },
            shop_id: { type: 'keyword' },
          },
        },
      });
      return true;
    } catch (error) {
      // Another application instance may have created the index at the same time.
      if (
        (error as { meta?: { statusCode?: number } }).meta?.statusCode === 400
      ) {
        return false;
      }
      throw error;
    }
  }

  async readSearchDocument(
    productId: string,
  ): Promise<ProductSearchDocument | null> {
    const rows = await this.dataSource.query(
      `SELECT p.id::text AS id, p.name, p.price::double precision AS price,
              p.sold_count, image.url AS image_url, s.name AS shop_name,
              p.category_id::text AS category_id, p.shop_id::text AS shop_id,
              p.created_at
       FROM products p
       INNER JOIN shops s ON s.id = p.shop_id
       LEFT JOIN LATERAL (
         SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id AND pi.sort_order = 0
         ORDER BY pi.id ASC LIMIT 1
       ) image ON TRUE
       WHERE p.id = $1 AND p.status = $2 AND p.is_deleted = 0
         AND s.status = $3`,
      [productId, ProductStatus.ACTIVE, ShopStatus.ACTIVE],
    );
    return rows[0]
      ? {
          ...rows[0],
          price: Number(rows[0].price),
          sold_count: Number(rows[0].sold_count),
        }
      : null;
  }

  async syncProduct(
    productId: string,
    refresh: boolean | 'wait_for' = false,
  ): Promise<void> {
    const document = await this.readSearchDocument(productId);
    if (!document) {
      try {
        await this.client.delete({
          index: PRODUCT_SEARCH_ALIAS,
          id: productId,
          refresh,
        });
      } catch (error) {
        if (
          (error as { meta?: { statusCode?: number } }).meta?.statusCode !== 404
        )
          throw error;
      }
      return;
    }
    await this.client.index({
      index: PRODUCT_SEARCH_ALIAS,
      id: productId,
      document,
      refresh,
    });
  }

  async searchProducts(options: ProductSearchOptions) {
    if (!this.ready) {
      throw new Error(
        'Elasticsearch product index backfill is not complete yet.',
      );
    }
    const filters: object[] = [];
    if (options.category_id)
      filters.push({ term: { category_id: options.category_id } });
    if (options.shop_id) filters.push({ term: { shop_id: options.shop_id } });
    const sort =
      options.sort_by === 'price_asc'
        ? [{ price: 'asc' as const }, { id: 'desc' as const }]
        : options.sort_by === 'price_desc'
          ? [{ price: 'desc' as const }, { id: 'desc' as const }]
          : options.search
            ? [{ _score: 'desc' as const }, { id: 'desc' as const }]
            : [{ id: 'desc' as const }];
    const response = await this.client.search<ProductSearchDocument>({
      index: PRODUCT_SEARCH_ALIAS,
      from: (options.page - 1) * options.limit,
      size: options.limit,
      track_total_hits: true,
      query: {
        bool: {
          ...(options.search
            ? {
                must: [
                  {
                    match: { name: { query: options.search, operator: 'and' } },
                  },
                ],
              }
            : { must: [{ match_all: {} }] }),
          filter: filters,
        },
      },
      sort: sort as never,
    });
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);
    return {
      items: response.hits.hits.flatMap((hit) =>
        hit._source
          ? [
              {
                id: hit._source.id,
                name: hit._source.name,
                price: hit._source.price.toFixed(2),
                sold_count: hit._source.sold_count,
                image_url: hit._source.image_url,
                shop_name: hit._source.shop_name,
              },
            ]
          : [],
      ),
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        total_pages: Math.ceil(total / options.limit),
      },
    };
  }

  async reindexAll(): Promise<void> {
    let lastId = '0';
    const batchSize = 500;
    while (true) {
      const rows: ProductSearchDocument[] = await this.dataSource.query(
        `SELECT p.id::text AS id, p.name, p.price::double precision AS price,
                p.sold_count, image.url AS image_url, s.name AS shop_name,
                p.category_id::text AS category_id, p.shop_id::text AS shop_id
         FROM products p INNER JOIN shops s ON s.id = p.shop_id
         LEFT JOIN LATERAL (
           SELECT pi.url FROM product_images pi
           WHERE pi.product_id = p.id AND pi.sort_order = 0
           ORDER BY pi.id ASC LIMIT 1
         ) image ON TRUE
         WHERE p.id > $1 AND p.status = $2 AND p.is_deleted = 0 AND s.status = $3
         ORDER BY p.id ASC LIMIT $4`,
        [lastId, ProductStatus.ACTIVE, ShopStatus.ACTIVE, batchSize],
      );
      if (!rows.length) break;
      const operations = rows.flatMap((row) => {
        const document = {
          ...row,
          price: Number(row.price),
          sold_count: Number(row.sold_count),
        };
        return [
          { index: { _index: PRODUCT_SEARCH_ALIAS, _id: document.id } },
          document,
        ];
      });
      const result = await this.client.bulk({ operations, refresh: false });
      if (result.errors) {
        const firstError = result.items.find((item) => item.index?.error)?.index
          ?.error;
        throw new Error(
          `Elasticsearch bulk reindex failed: ${JSON.stringify(firstError)}`,
        );
      }
      lastId = rows[rows.length - 1].id;
    }
    await this.client.indices.refresh({ index: PRODUCT_SEARCH_ALIAS });
    this.logger.log('Elasticsearch product search backfill completed.');
  }
}
