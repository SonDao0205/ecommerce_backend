import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from '../categories/categories.repository';
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

  getCategories() {
    return this.categoriesRepository.findAllActive();
  }
}
