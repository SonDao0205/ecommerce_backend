import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ProductService } from './product.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListShopProductsQueryDto } from './dto/list-shop-products-query.dto.js';
import { ApiResponseData } from '../dto/response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { UserRole } from '../user/entities/enums/user.enum.js';
import {
  isAllowedImageMimeType,
} from '../cloudinary/cloudinary.service.js';
import type { UploadImageFile } from '../cloudinary/cloudinary.service.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const PRODUCT_IMAGE_FIELDS = [
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'variant_images', maxCount: 20 },
];

type ProductImageFiles = {
  thumbnail?: UploadImageFile[];
  images?: UploadImageFile[];
  variant_images?: UploadImageFile[];
};

@Controller('api/v1/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * Chi tiết công khai cho client: category, shop, gallery, brand và
   * biến thể kèm thuộc tính (size/màu) cùng tồn kho.
   */
  @Get(':productId')
  async getProductDetail(@Param('productId') productId: string) {
    const product = await this.productService.getProductDetail(productId);
    return new ApiResponseData(
      true,
      'Lấy chi tiết sản phẩm thành công!',
      product,
      HttpStatus.OK,
    );
  }

  /** Danh sách sản phẩm đang bán của shop, có phân trang cho client. */
  @Get('shop/:shopId')
  async getShopProducts(
    @Param('shopId') shopId: string,
    @Query() query: ListShopProductsQueryDto,
  ) {
    const result = await this.productService.getShopProducts(shopId, query);
    return new ApiResponseData(
      true,
      'Lấy danh sách sản phẩm của shop thành công!',
      result,
      HttpStatus.OK,
    );
  }

  @Roles(UserRole.SELLER)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor(PRODUCT_IMAGE_FIELDS, {
      limits: { fileSize: MAX_IMAGE_SIZE, files: 31 },
      fileFilter: (_request, file, callback) => {
        if (!isAllowedImageMimeType(file.mimetype)) {
          callback(
            new BadRequestException(
              'Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  @Post()
  async create(
    @Req() request: Request,
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: ProductImageFiles,
  ) {
    const userId = (request as any).user?.id as string;
    const product = await this.productService.create(userId, dto, {
      thumbnail: files?.thumbnail?.[0],
      images: files?.images,
      variant_images: files?.variant_images,
    });
    return new ApiResponseData(
      true,
      'Tạo sản phẩm thành công!',
      product,
      HttpStatus.CREATED,
    );
  }

  @Roles(UserRole.SELLER)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor(PRODUCT_IMAGE_FIELDS, {
      limits: { fileSize: MAX_IMAGE_SIZE, files: 31 },
      fileFilter: (_request, file, callback) => {
        if (!isAllowedImageMimeType(file.mimetype)) {
          callback(
            new BadRequestException(
              'Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  @Patch(':productId')
  async update(
    @Req() request: Request,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files: ProductImageFiles,
  ) {
    const userId = (request as any).user?.id as string;
    const product = await this.productService.update(userId, productId, dto, {
      thumbnail: files?.thumbnail?.[0],
      images: files?.images,
      variant_images: files?.variant_images,
    });
    return new ApiResponseData(
      true,
      'Cập nhật sản phẩm thành công!',
      product,
      HttpStatus.OK,
    );
  }
}
