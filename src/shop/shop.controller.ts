import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ShopService } from './shop.service.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';
import { UserRole } from '../user/entities/enums/user.enum.js';
import { CreateShopDto } from './dto/create-shop.dto.js';
import { UpdateShopDto } from './dto/update-shop.dto.js';
import { ShopResponse } from './dto/shop.response.js';
import { ApiResponseData } from '../dto/response.js';
import { isAllowedImageMimeType } from '../cloudinary/cloudinary.service.js';
import type { UploadImageFile } from '../cloudinary/cloudinary.service.js';

const MAX_SHOP_IMAGE_SIZE = 5 * 1024 * 1024;

@Controller('api/v1/shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  /** Hồ sơ shop công khai cho client: mô tả, ảnh, liên hệ, trạng thái và số người theo dõi. */
  @Get(':shop_id')
  async getShopDetail(@Param('shop_id') shop_id: string) {
    const shop = await this.shopService.getPublicShopDetail(shop_id);
    return new ApiResponseData<ShopResponse>(
      true,
      'Lấy thông tin shop thành công!',
      new ShopResponse(shop),
      HttpStatus.OK,
    );
  }

  @Roles(UserRole.SELLER)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
      ],
      {
        limits: { fileSize: MAX_SHOP_IMAGE_SIZE, files: 2 },
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
      },
    ),
  )
  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateShopDto,
    @UploadedFiles()
    files?: { logo?: UploadImageFile[]; banner?: UploadImageFile[] },
  ) {
    const userId = (req as any).user?.id as string;
    const shop = await this.shopService.createShop(dto, userId, {
      logo: files?.logo?.[0],
      banner: files?.banner?.[0],
    });

    return new ApiResponseData<ShopResponse>(
      true,
      'Đã gửi yêu cầu tạo shop, vui lòng chờ admin duyệt!',
      new ShopResponse(shop),
      HttpStatus.CREATED,
    );
  }

  @Roles(UserRole.SELLER)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
      ],
      {
        limits: { fileSize: MAX_SHOP_IMAGE_SIZE, files: 2 },
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
      },
    ),
  )
  @Patch()
  async update(
    @Req() req: Request,
    @Body() dto: UpdateShopDto,
    @UploadedFiles()
    files?: { logo?: UploadImageFile[]; banner?: UploadImageFile[] },
  ) {
    const userId = (req as any).user?.id as string;
    const shop = await this.shopService.updateShop(dto, userId, {
      logo: files?.logo?.[0],
      banner: files?.banner?.[0],
    });

    return new ApiResponseData<ShopResponse>(
      true,
      'Cập nhật thông tin shop thành công!',
      new ShopResponse(shop),
      HttpStatus.OK,
    );
  }

  @Roles(UserRole.CLIENT)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @Post('/follow/:shop_id')
  async followShop(@Req() req: Request, @Param(`shop_id`) shop_id: string) {
    const userId = (req as any).user?.id as string;
    const followedShop = await this.shopService.followShop(userId, shop_id);

    return new ApiResponseData<boolean>(
      true,
      followedShop
        ? `Đã theo dõi shop thành công!`
        : `Đã huỷ theo dõi shop thành công!`,
      followedShop,
      followedShop ? HttpStatus.CREATED : HttpStatus.OK,
    );
  }
}
