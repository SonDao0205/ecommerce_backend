import { Controller, Get, Param, Query } from '@nestjs/common';
import { Category } from '@entities';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { StorefrontProduct } from '../products/products.repository';
import { StorefrontProductsQueryDto } from './dto/storefront-products-query.dto';
import { StorefrontService } from './storefront.service';

@Controller('storefront')
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('products')
  async getProducts(
    @Query() query: StorefrontProductsQueryDto,
  ): Promise<ApiResponseData<PaginatedData<StorefrontProduct>>> {
    return {
      status: true,
      message: 'Lấy danh sách sản phẩm cửa hàng thành công',
      data: await this.storefrontService.getProducts(query),
      code: 200,
    };
  }

  @Get('products/:slug')
  async getProductBySlug(
    @Param('slug') slug: string,
  ): Promise<ApiResponseData<StorefrontProduct>> {
    return {
      status: true,
      message: 'Lấy chi tiết sản phẩm thành công',
      data: await this.storefrontService.getProductBySlug(slug),
      code: 200,
    };
  }

  @Get('categories')
  async getCategories(): Promise<ApiResponseData<Category[]>> {
    return {
      status: true,
      message: 'Lấy danh mục cửa hàng thành công',
      data: await this.storefrontService.getCategories(),
      code: 200,
    };
  }
}
