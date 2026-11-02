import { Injectable } from '@nestjs/common';
import { ProductService } from '../product/product.service.js';
import { CatalogProductQueryDto } from './dto/catalog-product-query.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly productService: ProductService) {}

  getProducts = async (query: CatalogProductQueryDto) => {
    return this.productService.searchProducts(query);
  };
}
