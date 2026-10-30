import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../product/entities/product.entity.js';
import { ProductStatus } from '../product/entities/enum/product.enum.js';
import { ShopStatus } from '../shop/entities/enum/shop.enum.js';
import { CatalogProductQueryDto } from './dto/catalog-product-query.dto.js';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Tìm kiếm dạng AND theo token trên tên + mô tả bằng PostgreSQL FTS.
   * plainto_tsquery không tạo phrase query: `iphone pro max` khớp
   * `iPhone 15 Pro Max` vì ba từ đều có trong document dù có từ chen giữa.
   * Dùng cấu hình `simple` để không phụ thuộc stemming/ngôn ngữ tiếng Anh.
   */
  getProducts = async (query: CatalogProductQueryDto) => {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.shop', 'shop')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.brand', 'brand')
      .where('product.status = :productStatus', {
        productStatus: ProductStatus.ACTIVE,
      })
      .andWhere('product.is_deleted = :isDeleted', { isDeleted: 0 })
      .andWhere('shop.status = :shopStatus', { shopStatus: ShopStatus.ACTIVE });

    if (query.search) {
      // Keep the indexed expression in sync with idx_products_search_gin.
      const document = `to_tsvector('simple', coalesce(product.name, '') || ' ' || coalesce(product.description, ''))`;
      const searchQuery = `plainto_tsquery('simple', :search)`;
      queryBuilder
        .andWhere(`${document} @@ ${searchQuery}`, { search: query.search })
        .addSelect(`ts_rank(${document}, ${searchQuery})`, 'search_rank');
    }

    if (query.category_id) {
      queryBuilder.andWhere('product.category_id = :categoryId', {
        categoryId: query.category_id,
      });
    }
    if (query.shop_id) {
      queryBuilder.andWhere('product.shop_id = :shopId', {
        shopId: query.shop_id,
      });
    }

    switch (query.sort_by) {
      case 'price_asc':
        queryBuilder.orderBy('product.price', 'ASC');
        break;
      case 'price_desc':
        queryBuilder.orderBy('product.price', 'DESC');
        break;
      default:
        if (query.search) queryBuilder.orderBy('search_rank', 'DESC');
        else queryBuilder.orderBy('product.created_at', 'DESC');
    }

    queryBuilder
      .addOrderBy('product.created_at', 'DESC')
      .addOrderBy('product.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit),
      },
    };
  };
}
