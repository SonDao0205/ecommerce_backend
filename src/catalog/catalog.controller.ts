import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiResponseData } from '../dto/response.js';
import { CatalogService } from './catalog.service.js';
import { CatalogProductQueryDto } from './dto/catalog-product-query.dto.js';

@Controller('api/v1/catalog/products')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * Luồng: validate query params -> áp dụng bộ lọc sản phẩm công khai ->
   * tìm theo full-text nếu có search -> sort/paginate -> trả items và meta.
   *
   * Mock request:
   * GET /api/v1/catalog/products?search=iphone%20pro%20max&category_id=12&shop_id=4&sort_by=price_asc&page=1&limit=20
   * Kỳ vọng: sản phẩm ACTIVE, chưa xóa, thuộc category 12 và shop 4;
   * "iPhone 15 Pro Max" vẫn khớp vì search yêu cầu đủ token nhưng không yêu cầu
   * liền nhau hoặc theo đúng vị trí. Kết quả xếp giá tăng dần, tối đa 20 sản phẩm.
   * Mock kết quả rút gọn: { items: [{ id: "101", name: "iPhone 15 Pro Max",
   * price: "29000000" }], meta: { page: 1, limit: 20, total: 1, total_pages: 1 } }.
   */
  @Get()
  async getProducts(@Query() query: CatalogProductQueryDto) {
    const result = await this.catalogService.getProducts(query);
    return new ApiResponseData(
      true,
      'Lấy danh sách sản phẩm thành công!',
      result,
      HttpStatus.OK,
    );
  }
}
