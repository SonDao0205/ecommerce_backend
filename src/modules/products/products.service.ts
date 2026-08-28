import 'multer';
import { Product } from '@entities';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { GetAllDto } from 'src/database/dtos/common/get_all.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { ProductsRepository } from './products.repository';
import type { ProductVariantGroupInput } from './products.repository';
import { ProductSkuConflictError } from './products.repository';
import { ProductVariantRemovalConflictError } from './products.repository';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import type { UploadedImage } from '../cloudinary/cloudinary.service';
import { isUUID } from 'class-validator';
import { UpdateProductDto } from './dto/update-product.dto';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { DASHBOARD_CACHE_VERSION_KEY } from '../dashboard/dashboard-cache.constants';

type ImageManifestItem =
  { kind: 'existing'; url: string } | { kind: 'new'; fileIndex: number };

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly cache: RedisCacheService,
  ) {}

  async getAllProducts(query: GetAllDto): Promise<PaginatedData<Product>> {
    try {
      return await this.productsRepository.findPaginated(query);
    } catch {
      throw new InternalServerErrorException('Lỗi khi lấy danh sách sản phẩm!');
    }
  }

  createProduct = async (
    dto: CreateProductDto,
    files: Express.Multer.File[] = [],
    actorId?: string,
  ): Promise<Product> => {
    const { name, slug, description, sku, unitPrice, categoryId } = dto;
    const variants = this.resolveVariants(dto.variants);
    const inventoryStock = this.resolveInventoryStock(dto.stock, variants);
    await this.validateSkus(
      sku,
      variants.flatMap((group) => group.children.map((child) => child.sku)),
    );

    if (categoryId) await this.existsCategory(categoryId);
    const uploaded = await this.cloudinaryService.uploadImages(files);
    let images: string[];
    let thumbnailUrl: string | undefined;
    try {
      images = this.resolveImages(dto, uploaded);
      thumbnailUrl = this.resolveThumbnail(dto, images);
    } catch (error) {
      await this.cloudinaryService.removeImages(uploaded);
      throw error;
    }

    const newProduct = this.productsRepository.create({
      name,
      slug,
      description,
      sku,
      unitPrice,
      thumbnailUrl,
      images,
      category: { id: categoryId },
    });
    try {
      const saved = actorId
        ? await this.productsRepository.saveWithVariants(
            newProduct,
            variants,
            inventoryStock,
            actorId,
          )
        : await this.productsRepository.saveWithVariants(
            newProduct,
            variants,
            inventoryStock,
          );
      await this.cache.increment(DASHBOARD_CACHE_VERSION_KEY);
      return saved;
    } catch (error) {
      await this.cloudinaryService.removeImages(uploaded);
      if (error instanceof ProductSkuConflictError) {
        throw new ConflictException({
          message: 'SKU sản phẩm hoặc biến thể vừa được sử dụng.',
          fieldErrors: { sku: error.skus.join(', ') },
        });
      }
      throw new InternalServerErrorException('Lỗi khi thêm sản phẩm!');
    }
  };

  updateProduct = async (
    id: string,
    dto: UpdateProductDto,
    files: Express.Multer.File[] = [],
    actorId?: string,
  ): Promise<Product> => {
    const product = await this.findProductById(id);
    const { name, slug, description, sku, unitPrice, categoryId } = dto;
    const variants = dto.variants
      ? this.resolveVariants(dto.variants, true)
      : this.toVariantInputs(product);
    await this.validateSkus(
      sku,
      variants.flatMap((group) => group.children.map((child) => child.sku)),
      id,
    );
    if (categoryId) await this.existsCategory(categoryId);
    const uploaded = await this.cloudinaryService.uploadImages(files);
    let images: string[];
    let thumbnailUrl: string | undefined;
    try {
      images = this.resolveImages(dto, uploaded);
      thumbnailUrl = this.resolveThumbnail(dto, images);
    } catch (error) {
      await this.cloudinaryService.removeImages(uploaded);
      throw error;
    }
    product.name = name;
    product.slug = slug;
    product.description = description;
    product.sku = sku;
    product.unitPrice = unitPrice;
    product.thumbnailUrl = thumbnailUrl;
    product.images = images;
    product.category = { id: categoryId };
    try {
      const saved = actorId
        ? await this.productsRepository.updateWithVariants(
            product,
            variants,
            actorId,
          )
        : await this.productsRepository.updateWithVariants(product, variants);
      await this.cache.increment(DASHBOARD_CACHE_VERSION_KEY);
      return saved;
    } catch (error) {
      await this.cloudinaryService.removeImages(uploaded);
      if (error instanceof ProductSkuConflictError) {
        throw new ConflictException({
          message: 'SKU sản phẩm hoặc biến thể vừa được sử dụng.',
          fieldErrors: { sku: error.skus.join(', ') },
        });
      }
      if (error instanceof ProductVariantRemovalConflictError) {
        throw new ConflictException(error.message);
      }
      throw new InternalServerErrorException('Lỗi khi cập nhật sản phẩm!');
    }
  };

  updateStatus = async (id: string, isActive: boolean, actorId?: string) => {
    const product = await this.productsRepository.findById(id);
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm!');
    product.isActive = isActive;
    try {
      const saved = await this.productsRepository.save(product, actorId);
      await this.cache.increment(DASHBOARD_CACHE_VERSION_KEY);
      return saved;
    } catch {
      throw new InternalServerErrorException(
        `Lỗi khi ${isActive ? 'hiện' : 'ẩn'} sản phẩm!`,
      );
    }
  };

  existsCategory = async (id: string) => {
    const exist = await this.productsRepository.categoryExists(id);
    if (!exist) {
      throw new NotFoundException('Danh mục không hợp lệ!');
    }
  };

  findProductById = async (id: string): Promise<Product> => {
    const exist = await this.productsRepository.findById(id);
    if (!exist) {
      throw new NotFoundException('Không tìm thấy sản phẩm!');
    }
    return exist;
  };

  async validateSkus(
    sku: string,
    variantSkus: string[],
    productId?: string,
  ): Promise<void> {
    const normalizedProductSku = sku.trim().toLowerCase();
    const normalizedVariants = variantSkus.map((item) =>
      item.trim().toLowerCase(),
    );
    const variantErrors: Record<string, string> = {};
    const counts = new Map<string, number>();
    normalizedVariants.forEach((item) =>
      counts.set(item, (counts.get(item) ?? 0) + 1),
    );

    for (const [index, normalized] of normalizedVariants.entries()) {
      const original = variantSkus[index];
      if ((counts.get(normalized) ?? 0) > 1) {
        variantErrors[original] = 'SKU biến thể bị trùng trong sản phẩm này.';
      }
      if (normalized === normalizedProductSku) {
        variantErrors[original] = 'SKU biến thể không được trùng SKU sản phẩm.';
      }
    }

    const [
      productExists,
      productSkuInVariants,
      variantsInProducts,
      variantsExisting,
    ] = await Promise.all([
      this.productsRepository.productSkuExists(sku, productId),
      this.productsRepository.variantSkusExisting([sku], productId),
      this.productsRepository.productSkusExisting(variantSkus, productId),
      this.productsRepository.variantSkusExisting(variantSkus, productId),
    ]);

    const fieldErrors: { sku?: string; variantSkus?: Record<string, string> } =
      {};
    if (productExists || productSkuInVariants.length > 0) {
      fieldErrors.sku = 'SKU sản phẩm đã tồn tại.';
    }
    const occupiedVariantSkus = new Set(
      [...variantsInProducts, ...variantsExisting].map((item) =>
        item.toLowerCase(),
      ),
    );
    variantSkus.forEach((variantSku) => {
      if (occupiedVariantSkus.has(variantSku.toLowerCase())) {
        variantErrors[variantSku] = 'SKU biến thể đã tồn tại.';
      }
    });
    if (Object.keys(variantErrors).length > 0)
      fieldErrors.variantSkus = variantErrors;

    if (fieldErrors.sku || fieldErrors.variantSkus) {
      throw new ConflictException({
        message: 'Vui lòng kiểm tra lại SKU sản phẩm và biến thể.',
        fieldErrors,
      });
    }
  }

  private resolveImages(
    dto: CreateProductDto,
    uploaded: UploadedImage[],
  ): string[] {
    if (!dto.imageManifest)
      return dto.images ?? uploaded.map((item) => item.url);

    let manifest: ImageManifestItem[];
    try {
      manifest = JSON.parse(dto.imageManifest) as ImageManifestItem[];
    } catch {
      throw new BadRequestException('Danh sách thứ tự ảnh không hợp lệ');
    }

    if (!Array.isArray(manifest)) {
      throw new BadRequestException('Danh sách thứ tự ảnh không hợp lệ');
    }
    if (manifest.length > 6) {
      throw new BadRequestException('Mỗi sản phẩm chỉ được có tối đa 6 ảnh');
    }

    return manifest.map((item) => {
      if (item.kind === 'existing' && typeof item.url === 'string')
        return item.url;
      if (
        item.kind === 'new' &&
        Number.isInteger(item.fileIndex) &&
        uploaded[item.fileIndex]
      ) {
        return uploaded[item.fileIndex].url;
      }
      throw new BadRequestException('Thứ tự ảnh không khớp với tệp đã gửi');
    });
  }

  private resolveThumbnail(
    dto: CreateProductDto,
    images: string[],
  ): string | undefined {
    if (dto.thumbnailIndex === undefined) return dto.thumbnailUrl ?? images[0];
    if (!images[dto.thumbnailIndex]) {
      throw new BadRequestException('Ảnh đại diện không hợp lệ');
    }
    return images[dto.thumbnailIndex];
  }

  private resolveVariants(
    raw?: string,
    preserveExistingStock = false,
  ): ProductVariantGroupInput[] {
    if (!raw) return [];
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Dữ liệu biến thể không hợp lệ');
    }
    if (!Array.isArray(value) || value.length > 30) {
      throw new BadRequestException('Dữ liệu biến thể không hợp lệ');
    }

    return value.map((group) => {
      if (
        !this.isRecord(group) ||
        !Array.isArray(group.children) ||
        group.children.length === 0
      ) {
        throw new BadRequestException(
          'Mỗi nhóm biến thể phải có ít nhất một biến thể con',
        );
      }
      const name = this.requiredText(group.name, 'Tên nhóm biến thể');
      const groupValue = this.requiredText(group.value, 'Giá trị biến thể cha');
      const id = this.optionalUuid(group.id, 'ID nhóm biến thể');
      const children = group.children.map((child) => {
        if (!this.isRecord(child)) {
          throw new BadRequestException('Biến thể con không hợp lệ');
        }
        const unitPrice = Number(child.unitPrice);
        const stock = preserveExistingStock ? 0 : Number(child.stock);
        const childId = this.optionalUuid(child.id, 'ID biến thể con');
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new BadRequestException(
            'Giá biến thể phải lớn hơn hoặc bằng 0',
          );
        }
        if (!preserveExistingStock && (!Number.isInteger(stock) || stock < 0)) {
          throw new BadRequestException(
            'Tồn kho biến thể phải là số nguyên không âm',
          );
        }
        return {
          ...(childId ? { id: childId } : {}),
          name: this.requiredText(child.name, 'Tên biến thể con'),
          value: this.requiredText(child.value, 'Giá trị biến thể con'),
          sku: this.requiredText(child.sku, 'SKU biến thể'),
          unitPrice,
          stock,
        };
      });
      return { ...(id ? { id } : {}), name, value: groupValue, children };
    });
  }

  private resolveInventoryStock(
    productStock: number | undefined,
    variants: ProductVariantGroupInput[],
  ): number {
    if (variants.length > 0) {
      return variants.reduce(
        (total, group) =>
          total +
          group.children.reduce(
            (groupTotal, variant) => groupTotal + variant.stock,
            0,
          ),
        0,
      );
    }
    if (!Number.isInteger(productStock) || (productStock ?? -1) < 0) {
      throw new BadRequestException(
        'Sản phẩm không có biến thể phải nhập tồn kho là số nguyên không âm',
      );
    }
    return productStock!;
  }

  private toVariantInputs(product: Product): ProductVariantGroupInput[] {
    return (product.variants ?? []).map((group) => ({
      ...(group.id ? { id: group.id } : {}),
      name: group.name,
      value: group.value,
      children: (group.children ?? []).map((child) => ({
        ...(child.id ? { id: child.id } : {}),
        name: child.name,
        value: child.value,
        sku: child.sku ?? '',
        unitPrice: Number(child.unitPrice ?? 0),
        stock: child.stock,
      })),
    }));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private requiredText(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} không được để trống`);
    }
    return value.trim();
  }

  private optionalUuid(value: unknown, field: string): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || !isUUID(value)) {
      throw new BadRequestException(`${field} không hợp lệ`);
    }
    return value;
  }
}
