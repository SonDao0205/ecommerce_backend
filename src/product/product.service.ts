import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Shop } from '../shop/entities/shop.entity.js';
import { ShopStatus } from '../shop/entities/enum/shop.enum.js';
import { Categories } from '../category/entities/categories.entity.js';
import {
  CloudinaryImageKey,
  CloudinaryService,
} from '../cloudinary/cloudinary.service.js';
import type {
  CloudinaryUploadResult,
  UploadImageFile,
} from '../cloudinary/cloudinary.service.js';
import { Brand } from './entities/brand.entity.js';
import { Product } from './entities/product.entity.js';
import { ProductImage } from './entities/product_image.entity.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductStatus } from './entities/enum/product.enum.js';
import { ProductVariantService } from './product-variant.service.js';

type ProductUploadFiles = {
  thumbnail?: UploadImageFile;
  images?: UploadImageFile[];
  variant_images?: UploadImageFile[];
};

type ProductUploadResults = {
  thumbnail?: CloudinaryUploadResult;
  images: CloudinaryUploadResult[];
  variantImages: Map<number, CloudinaryUploadResult>;
};

type ProductVariantImageInput = { image_file_index?: number };

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Categories)
    private readonly categoriesRepository: Repository<Categories>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
    private readonly productVariantService: ProductVariantService,
  ) {}

  /** Đọc một sản phẩm cùng ảnh và biến thể để AdminService xử lý duyệt. */
  findForVerification = async (productId: string): Promise<Product | null> => {
    return this.productRepository.findOne({
      where: { id: productId },
      relations: { images: true, variants: true },
    });
  };

  /** Lưu thay đổi của sản phẩm đã được AdminService quyết định. */
  saveProduct = async (product: Product): Promise<Product> => {
    return this.productRepository.save(product);
  };

  /**
   * Tạo sản phẩm mới cho shop của seller.
   * Luồng: kiểm tra shop/category/brand và slug -> upload ảnh -> ghi product,
   * ảnh và biến thể trong một transaction -> xóa ảnh Cloudinary nếu ghi DB lỗi.
   */
  create = async (
    userId: string,
    dto: CreateProductDto,
    files: ProductUploadFiles = {},
  ) => {
    const shop = await this.getActiveSellerShop(userId);
    const category = await this.getActiveCategory(dto.category_id);
    if (dto.brand_id) await this.getActiveBrand(dto.brand_id);

    const existingSlug = await this.productRepository.findOne({
      where: { slug: dto.slug.trim() },
    });
    if (existingSlug) throw new ConflictException('Slug sản phẩm đã tồn tại.');

    const uploaded: CloudinaryUploadResult[] = [];
    try {
      const images = await this.uploadFiles(
        files,
        dto.variants ?? [],
        uploaded,
      );

      return await this.dataSource.transaction(async (manager) => {
        const products = manager.getRepository(Product);
        const product = await products.save(
          products.create({
            shop_id: shop.id,
            shop,
            category_id: category.id,
            category,
            brand_id: dto.brand_id ?? null,
            name: dto.name.trim(),
            slug: dto.slug.trim(),
            description: dto.description?.trim() || null,
            thumbnail_url:
              images.thumbnail?.secure_url ??
              images.images[0]?.secure_url ??
              null,
            price: dto.price,
            status: dto.status ?? ProductStatus.PENDING,
          }),
        );

        await this.saveProductImages(manager, product, images, true);
        await this.productVariantService.saveProductVariants(
          manager,
          product,
          category.id,
          dto.variants ?? [],
          images.variantImages,
        );

        return this.loadProduct(manager, product.id);
      });
    } catch (error) {
      await this.cleanupUploads(uploaded);
      this.rethrowConstraintError(error);
    }
  };

  /**
   * Cập nhật sản phẩm của seller theo trạng thái hiện tại.
   * DRAFT được sửa nội dung; ACTIVE/HIDDEN chỉ được đổi trạng thái; các trạng
   * thái chờ duyệt/từ chối không cho seller chỉnh sửa. Ảnh và thay đổi DB được
   * xử lý cùng luồng transaction như khi tạo sản phẩm.
   */
  update = async (
    userId: string,
    productId: string,
    dto: UpdateProductDto,
    files: ProductUploadFiles = {},
  ) => {
    const shop = await this.getActiveSellerShop(userId);
    const product = await this.getOwnedProduct(productId, shop.id);

    if (
      product.status === ProductStatus.ACTIVE ||
      product.status === ProductStatus.HIDDEN
    ) {
      const onlyStatus = Object.keys(dto).every((key) => key === 'status');
      const hasUploads = Boolean(
        files.thumbnail || files.images?.length || files.variant_images?.length,
      );
      if (!onlyStatus || hasUploads) {
        throw new ForbiddenException(
          'Sản phẩm đang hoạt động chỉ được chuyển trạng thái ACTIVE/HIDDEN.',
        );
      }
      if (
        dto.status !== ProductStatus.ACTIVE &&
        dto.status !== ProductStatus.HIDDEN
      ) {
        throw new BadRequestException(
          'Sản phẩm ACTIVE/HIDDEN chỉ được chuyển qua lại giữa hai trạng thái này.',
        );
      }

      product.status = dto.status;
      return this.productRepository.save(product);
    }

    if (product.status !== ProductStatus.DRAFT) {
      throw new ForbiddenException(
        'Chỉ sản phẩm DRAFT mới được chỉnh sửa nội dung; sản phẩm PENDING đang chờ duyệt.',
      );
    }
    if (
      dto.status &&
      dto.status !== ProductStatus.DRAFT &&
      dto.status !== ProductStatus.PENDING
    ) {
      throw new ForbiddenException(
        'Seller chỉ có thể giữ bản nháp hoặc gửi sản phẩm sang PENDING.',
      );
    }
    if (
      Object.keys(dto).length === 0 &&
      !files.thumbnail &&
      !files.images?.length &&
      !files.variant_images?.length
    ) {
      throw new BadRequestException(
        'Không có thông tin nào được gửi để cập nhật.',
      );
    }

    const categoryId = dto.category_id ?? product.category_id;
    const category = dto.category_id
      ? await this.getActiveCategory(dto.category_id)
      : undefined;
    if (dto.brand_id) await this.getActiveBrand(dto.brand_id);

    const newSlug = dto.slug?.trim();
    if (newSlug && newSlug !== product.slug) {
      const existingSlug = await this.productRepository.findOne({
        where: { slug: newSlug },
      });
      if (existingSlug && existingSlug.id !== product.id) {
        throw new ConflictException('Slug sản phẩm đã tồn tại.');
      }
    }

    const uploaded: CloudinaryUploadResult[] = [];
    try {
      const images = await this.uploadFiles(
        files,
        dto.variants ?? [],
        uploaded,
      );

      return await this.dataSource.transaction(async (manager) => {
        const products = manager.getRepository(Product);

        if (dto.name !== undefined) product.name = dto.name.trim();
        if (newSlug !== undefined) product.slug = newSlug;
        if (category) {
          product.category = category;
          product.category_id = category.id;
        }
        if (Object.prototype.hasOwnProperty.call(dto, 'brand_id')) {
          product.brand_id = dto.brand_id ?? null;
          product.brand = dto.brand_id
            ? await manager.getRepository(Brand).findOneByOrFail({
                id: dto.brand_id,
              })
            : null;
        }
        if (dto.description !== undefined) {
          product.description = dto.description?.trim() || null;
        }
        if (dto.price !== undefined) product.price = dto.price;
        if (dto.status !== undefined) product.status = dto.status;

        if (images.thumbnail) {
          product.thumbnail_url = images.thumbnail.secure_url;
        } else if (!product.thumbnail_url && images.images.length > 0) {
          product.thumbnail_url = images.images[0].secure_url;
        }

        await products.save(product);
        await this.saveProductImages(manager, product, images, false);
        await this.productVariantService.saveProductVariants(
          manager,
          product,
          categoryId,
          dto.variants ?? [],
          images.variantImages,
        );

        return this.loadProduct(manager, product.id);
      });
    } catch (error) {
      await this.cleanupUploads(uploaded);
      this.rethrowConstraintError(error);
    }
  };

  /** Lấy shop của seller và yêu cầu shop đã được admin duyệt. */
  private async getActiveSellerShop(userId: string): Promise<Shop> {
    const shop = await this.shopRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });
    if (!shop) throw new NotFoundException('Không tìm thấy shop của seller.');
    if (shop.status !== ShopStatus.ACTIVE) {
      throw new ForbiddenException(
        'Shop cần được admin duyệt trước khi đăng sản phẩm.',
      );
    }
    return shop;
  }

  /** Chỉ cho phép gắn sản phẩm vào danh mục đang hoạt động. */
  private async getActiveCategory(categoryId: string): Promise<Categories> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId, is_active: 1 },
    });
    if (!category)
      throw new NotFoundException('Danh mục không tồn tại hoặc đã bị ẩn.');
    return category;
  }

  /** Kiểm tra thương hiệu tồn tại và đang hoạt động trước khi gắn vào product. */
  private async getActiveBrand(brandId: string): Promise<Brand> {
    const brand = await this.brandRepository.findOne({
      where: { id: brandId, is_active: 1 },
    });
    if (!brand)
      throw new NotFoundException('Thương hiệu không tồn tại hoặc đã bị ẩn.');
    return brand;
  }

  /** Tìm product chưa xóa mềm và thuộc shop hiện tại, tránh sửa sản phẩm shop khác. */
  private async getOwnedProduct(
    productId: string,
    shopId: string,
  ): Promise<Product> {
    if (!/^\d+$/.test(productId)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ.');
    }
    const product = await this.productRepository.findOne({
      where: { id: productId, shop_id: shopId, is_deleted: 0 },
    });
    if (!product)
      throw new NotFoundException('Không tìm thấy sản phẩm của shop.');
    return product;
  }

  /**
   * Kiểm tra file biến thể được ánh xạ đúng index, tải thumbnail/gallery/ảnh
   * biến thể lên Cloudinary và giữ kết quả để lưu URL hoặc cleanup khi lỗi.
   */
  private async uploadFiles(
    files: ProductUploadFiles,
    variants: ProductVariantImageInput[],
    uploaded: CloudinaryUploadResult[],
  ): Promise<ProductUploadResults> {
    const variantFiles = files.variant_images ?? [];
    const indexes = variants
      .map((variant) => variant.image_file_index)
      .filter((index): index is number => index !== undefined);
    if (new Set(indexes).size !== indexes.length) {
      throw new BadRequestException('Mỗi ảnh biến thể phải có index riêng.');
    }
    if (indexes.some((index) => index >= variantFiles.length)) {
      throw new BadRequestException(
        'image_file_index không khớp với danh sách file variant_images.',
      );
    }
    if (indexes.length !== variantFiles.length) {
      throw new BadRequestException(
        'Mỗi file variant_images cần được gắn vào một biến thể qua image_file_index.',
      );
    }
    if (variantFiles.length > 20 || (files.images?.length ?? 0) > 10) {
      throw new BadRequestException('Vượt quá số lượng ảnh cho phép.');
    }

    const results: ProductUploadResults = {
      images: [],
      variantImages: new Map(),
    };
    const upload = async (file: UploadImageFile) => {
      const result = await this.cloudinaryService.uploadImage(
        file,
        CloudinaryImageKey.ProductImage,
      );
      uploaded.push(result);
      return result;
    };

    if (files.thumbnail) results.thumbnail = await upload(files.thumbnail);
    for (const file of files.images ?? []) {
      results.images.push(await upload(file));
    }
    for (const variant of variants) {
      if (variant.image_file_index === undefined) continue;
      results.variantImages.set(
        variant.image_file_index,
        await upload(variantFiles[variant.image_file_index]),
      );
    }
    return results;
  }

  /** Lưu URL ảnh Cloudinary vào gallery và đồng bộ ảnh đại diện của product. */
  private async saveProductImages(
    manager: EntityManager,
    product: Product,
    uploaded: ProductUploadResults,
    isCreate: boolean,
  ): Promise<void> {
    const hasNewThumbnail = Boolean(uploaded.thumbnail);
    const imageFiles = [
      ...(uploaded.thumbnail ? [uploaded.thumbnail] : []),
      ...uploaded.images,
    ];
    if (imageFiles.length === 0) return;

    const repository = manager.getRepository(ProductImage);
    let sortOrder = 0;
    let hasPrimary =
      !isCreate && Boolean(product.thumbnail_url && !hasNewThumbnail);
    if (!isCreate) {
      const existingImages = await repository.find({
        where: { product_id: product.id },
        order: { sort_order: 'DESC' },
        take: 1,
      });
      sortOrder = existingImages[0]?.sort_order + 1 || 0;
      if (hasNewThumbnail) {
        await repository.update({ product_id: product.id }, { is_primary: 0 });
      }
    }

    const records: ProductImage[] = [];
    for (let index = 0; index < imageFiles.length; index += 1) {
      const image = imageFiles[index];
      const makePrimary =
        (hasNewThumbnail && index === 0) ||
        (!hasPrimary && index === 0 && !uploaded.thumbnail);
      if (makePrimary) {
        product.thumbnail_url = image.secure_url;
        hasPrimary = true;
      }
      records.push(
        repository.create({
          product_id: product.id,
          product,
          url: image.secure_url,
          sort_order: sortOrder + index,
          is_primary: makePrimary ? 1 : 0,
        }),
      );
    }
    await repository.save(records);
  }

  /** Tải lại sản phẩm vừa ghi kèm ảnh, danh mục, thương hiệu và biến thể. */
  private async loadProduct(manager: EntityManager, id: string) {
    return manager.getRepository(Product).findOne({
      where: { id },
      relations: {
        images: true,
        category: true,
        brand: true,
        variants: {
          attribute_values: { attribute_value: { attribute: true } },
        },
      },
    });
  }

  /** Xóa các file vừa upload nếu transaction DB thất bại để tránh ảnh mồ côi. */
  private async cleanupUploads(
    uploads: CloudinaryUploadResult[],
  ): Promise<void> {
    await Promise.allSettled(
      uploads.map((image) =>
        this.cloudinaryService.deleteImage(image.public_id),
      ),
    );
  }

  /** Đổi lỗi unique từ Postgres thành phản hồi conflict dễ hiểu cho client. */
  private rethrowConstraintError(error: unknown): never {
    if ((error as { code?: string })?.code === '23505') {
      throw new ConflictException('Slug sản phẩm hoặc SKU đã tồn tại.');
    }
    throw error;
  }
}
