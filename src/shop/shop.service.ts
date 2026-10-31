import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Shop } from './entities/shop.entity.js';
import { ShopFollower } from './entities/shop_follower.entity.js';
import { CreateShopDto } from './dto/create-shop.dto.js';
import { UpdateShopDto } from './dto/update-shop.dto.js';
import { ShopStatus } from './entities/enum/shop.enum.js';
import { UserRole } from '../user/entities/enums/user.enum.js';
import { UserService } from '../user/user.service.js';
import {
  CloudinaryImageKey,
  CloudinaryService,
} from '../cloudinary/cloudinary.service.js';
import type {
  CloudinaryUploadResult,
  UploadImageFile,
} from '../cloudinary/cloudinary.service.js';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Shop) private readonly shopRepository: Repository<Shop>,
    private readonly dataSource: DataSource,
    @Inject() private readonly userService: UserService,
    @Inject() private readonly cloudinaryService: CloudinaryService,
  ) {}

  findById = async (shopId: string) => {
    return await this.shopRepository.findOne({
      where: { id: shopId },
    });
  };

  /** Trả shop đang hoạt động của seller cho ProductModule qua service boundary. */
  getActiveShopByOwnerId = async (userId: string): Promise<Shop> => {
    const shop = await this.shopRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!shop) {
      throw new NotFoundException('Không tìm thấy shop của seller.');
    }
    if (shop.status !== ShopStatus.ACTIVE) {
      throw new ForbiddenException(
        'Shop cần được admin duyệt trước khi đăng sản phẩm.',
      );
    }
    return shop;
  };

  /** Chỉ công khai hồ sơ của shop đã được duyệt và đang hoạt động. */
  getPublicShopDetail = async (shopId: string): Promise<Shop> => {
    if (!/^\d+$/.test(shopId)) {
      throw new BadRequestException('ID shop không hợp lệ.');
    }

    const shop = await this.shopRepository.findOne({
      where: { id: shopId, status: ShopStatus.ACTIVE },
    });
    if (!shop) {
      throw new NotFoundException('Không tìm thấy shop đang hoạt động.');
    }
    return shop;
  };

  createShop = async (
    dto: CreateShopDto,
    userId: string,
    images: { logo?: UploadImageFile; banner?: UploadImageFile } = {},
  ) => {
    const user = await this.userService.findById(userId);
    if (user.role !== UserRole.SELLER) {
      throw new ForbiddenException('Chỉ tài khoản seller mới được tạo shop!');
    }
    if (user.email_verified == 0) {
      throw new BadRequestException('Tài khoản này chưa được xác thực email!');
    }

    const existingShop = await this.shopRepository.findOne({
      where: { user: { id: userId } },
    });
    if (existingShop) {
      throw new ConflictException('Tài khoản này đã có shop!');
    }

    let uploadedLogo: CloudinaryUploadResult | undefined;
    let uploadedBanner: CloudinaryUploadResult | undefined;

    try {
      if (images.logo) {
        uploadedLogo = await this.cloudinaryService.uploadImage(
          images.logo,
          CloudinaryImageKey.ShopLogo,
        );
      }
      if (images.banner) {
        uploadedBanner = await this.cloudinaryService.uploadImage(
          images.banner,
          CloudinaryImageKey.ShopBanner,
        );
      }

      const shop = this.shopRepository.create({
        user,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        logo_url: uploadedLogo?.secure_url ?? null,
        banner_url: uploadedBanner?.secure_url ?? null,
        phone: dto.phone?.trim() || user.phone,
        warehouse_address: dto.warehouse_address?.trim() || null,
        status: ShopStatus.PENDING,
        reject_reason: null,
        approved_at: null,
      });

      return await this.shopRepository.save(shop);
    } catch (error) {
      const uploadedImages = [uploadedLogo, uploadedBanner].filter(
        (image): image is CloudinaryUploadResult => image !== undefined,
      );
      await Promise.allSettled(
        uploadedImages.map((image) =>
          this.cloudinaryService.deleteImage(image.public_id),
        ),
      );
      throw error;
    }
  };

  updateShop = async (
    dto: UpdateShopDto,
    userId: string,
    images: { logo?: UploadImageFile; banner?: UploadImageFile } = {},
  ) => {
    const shop = await this.shopRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!shop) {
      throw new NotFoundException('Không tìm thấy shop của tài khoản này!');
    }

    const updates: Partial<Shop> = {};

    if (Object.prototype.hasOwnProperty.call(dto, 'name')) {
      const name = dto.name?.trim();
      if (!name) {
        throw new BadRequestException('Tên shop không được bỏ trống!');
      }

      const existingShop = await this.shopRepository.findOne({
        where: { name },
      });
      if (existingShop && existingShop.id !== shop.id) {
        throw new ConflictException('Tên shop đã được sử dụng!');
      }
      updates.name = name;
    }

    const assignOptionalString = (
      field:
        | 'description'
        | 'logo_url'
        | 'banner_url'
        | 'phone'
        | 'warehouse_address',
    ) => {
      if (!Object.prototype.hasOwnProperty.call(dto, field)) return;

      const value = dto[field];
      updates[field] = value == null ? null : value.trim();
    };

    assignOptionalString('description');
    assignOptionalString('logo_url');
    assignOptionalString('banner_url');
    assignOptionalString('phone');
    assignOptionalString('warehouse_address');

    let uploadedLogo: CloudinaryUploadResult | undefined;
    let uploadedBanner: CloudinaryUploadResult | undefined;

    try {
      if (images.logo) {
        uploadedLogo = await this.cloudinaryService.uploadImage(
          images.logo,
          CloudinaryImageKey.ShopLogo,
        );
        updates.logo_url = uploadedLogo.secure_url;
      }
      if (images.banner) {
        uploadedBanner = await this.cloudinaryService.uploadImage(
          images.banner,
          CloudinaryImageKey.ShopBanner,
        );
        updates.banner_url = uploadedBanner.secure_url;
      }

      return await this.shopRepository.save(Object.assign(shop, updates));
    } catch (error) {
      const uploadedImages = [uploadedLogo, uploadedBanner].filter(
        (image): image is CloudinaryUploadResult => image !== undefined,
      );
      await Promise.allSettled(
        uploadedImages.map((image) =>
          this.cloudinaryService.deleteImage(image.public_id),
        ),
      );
      throw error;
    }
  };

  followShop = async (userId: string, shopId: string): Promise<boolean> => {
    if (!/^\d+$/.test(shopId)) {
      throw new BadRequestException('ID shop không hợp lệ.');
    }

    return this.dataSource.transaction(async (manager) => {
      const shops = manager.getRepository(Shop);
      const followers = manager.getRepository(ShopFollower);
      const shop = await shops.findOne({
        where: { id: shopId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shop) throw new NotFoundException('Không tìm thấy shop hợp lệ.');
      if (shop.status !== ShopStatus.ACTIVE) {
        throw new BadRequestException('Shop chưa được phê duyệt.');
      }

      const existingFollow = await followers.findOne({
        where: { shop_id: shopId, user_id: userId },
      });
      if (existingFollow) {
        await followers.remove(existingFollow);
        await shops.decrement({ id: shopId }, 'follower_count', 1);
        return false;
      }

      await followers.save(
        followers.create({ shop_id: shopId, user_id: userId }),
      );
      await shops.increment({ id: shopId }, 'follower_count', 1);
      return true;
    });
  };
}
