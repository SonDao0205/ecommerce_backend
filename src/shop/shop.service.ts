import {
  BadRequestException,
  ConflictException,
  flatten,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Shop } from './entities/shop.entity.js';
import { Repository } from 'typeorm';
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
    @InjectRepository(ShopFollower)
    private readonly shopFollowerRepository: Repository<ShopFollower>,
    @Inject() private readonly userService: UserService,
    @Inject() private readonly cloudinaryService: CloudinaryService,
  ) {}

  findById = async (shopId: string) => {
    return await this.shopRepository.findOne({
      where: { id: shopId },
    });
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
    const shop = await this.findById(shopId);

    if (!shop) {
      throw new NotFoundException('Không tìm thấy Shop hợp lệ!');
    }

    if (shop.status !== ShopStatus.ACTIVE)
      throw new BadRequestException(`Shop chưa được phê duyệt!`);

    const shopFollower = await this.shopFollowerRepository.findOne({
      where: {
        shop: { id: shopId },
        user: { id: userId },
      },
    });

    if (shopFollower) {
      await this.shopFollowerRepository.remove(shopFollower);
      return false;
    }

    const newShopFollower = this.shopFollowerRepository.create({
      shop_id: shopId,
      user_id: userId,
    });

    await this.shopFollowerRepository.save(newShopFollower);
    return true;
  };
}
