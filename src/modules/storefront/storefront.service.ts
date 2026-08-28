import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Category } from '@entities';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { STOREFRONT_CATEGORIES_CACHE_KEY } from '../categories/category-cache.constants';
import {
  ProductsRepository,
  StorefrontProduct,
} from '../products/products.repository';
import { StorefrontProductsQueryDto } from './dto/storefront-products-query.dto';

@Injectable()
export class StorefrontService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly cache: RedisCacheService,
    private readonly configService: ConfigService,
  ) {}

  getProducts(query: StorefrontProductsQueryDto) {
    return this.productsRepository.findStorefrontPaginated({
      page: query.page,
      limit: query.limit,
      search: query.search,
      categorySlug: query.category,
    });
  }

  async getProductBySlug(slug: string): Promise<StorefrontProduct> {
    const product = await this.productsRepository.findStorefrontBySlug(slug);
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm!');
    return product;
  }

  async getCategories(): Promise<Category[]> {
    const cached = await this.cache.getJson<Category[]>(
      STOREFRONT_CATEGORIES_CACHE_KEY,
    );
    if (cached !== null) return cached;

    const categories = await this.categoriesRepository.findAllActive();
    const ttl = Number(
      this.configService.get<string>(
        'STOREFRONT_CATEGORIES_CACHE_TTL_SECONDS',
        '600',
      ),
    );
    await this.cache.setJson(STOREFRONT_CATEGORIES_CACHE_KEY, categories, ttl);
    return categories;
  }
}
