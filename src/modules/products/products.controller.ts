import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Put,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { Product, UserRoleEnum } from '@entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { GetAllDto } from 'src/database/dtos/common/get_all.dto';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { UpdateStatusDto } from 'src/database/dtos/common/update_status.dto';
import { ValidateProductSkusDto } from './dto/validate-product-skus.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { UpdateProductDto } from './dto/update-product.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productService: ProductsService) {}

  @Roles(UserRoleEnum.ADMIN)
  @Post('validate-skus')
  async validateSkus(
    @Body() dto: ValidateProductSkusDto,
  ): Promise<ApiResponseData<null>> {
    await this.productService.validateSkus(
      dto.sku,
      dto.variantSkus,
      dto.productId,
    );
    return {
      status: true,
      message: 'SKU hợp lệ',
      data: null,
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Get()
  async getAllProducts(
    @Query() query: GetAllDto,
  ): Promise<ApiResponseData<PaginatedData<Product>>> {
    return {
      status: true,
      message: 'Lấy danh sách sản phẩm thành công!',
      data: await this.productService.getAllProducts(query),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Post()
  async createProduct(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProductDto,
  ): Promise<ApiResponseData<Product>> {
    return {
      status: true,
      message: 'Thêm sản phẩm thành công!',
      data: await this.productService.createProduct(dto, [], req.user.id),
      code: 201,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Put(':id')
  async updateProduct(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProductDto,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseData<Product>> {
    return {
      status: true,
      message: 'Cập nhật sản phẩm thành công!',
      data: await this.productService.updateProduct(id, dto, [], req.user.id),
      code: 201,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Patch(':id/status')
  async updateProductStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<ApiResponseData<Product>> {
    return {
      status: true,
      message: dto.isActive
        ? 'Hiện sản phẩm thành công!'
        : 'Ẩn sản phẩm thành công!',
      data: await this.productService.updateStatus(
        id,
        dto.isActive,
        req.user.id,
      ),
      code: 200,
    };
  }
}
