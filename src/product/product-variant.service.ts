import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { CategoryAttribute } from '../category/entities/category_attribute.entity.js';
import { AttributeValues } from '../category/entities/attribute_values.entity.js';
import type { CloudinaryUploadResult } from '../cloudinary/cloudinary.service.js';
import { Product } from './entities/product.entity.js';
import { ProductVariant } from './entities/product_variant.entity.js';
import { VariantAttributeValue } from './entities/variant_attribute_value.entity.js';
import {
  ProductStatus,
  ProductVariantStatus,
} from './entities/enum/product.enum.js';
import { ShopStatus } from '../shop/entities/enum/shop.enum.js';
import {
  CreateProductVariantDto,
  ProductVariantAttributeDto,
  UpdateProductVariantDto,
} from './dto/product-variant.dto.js';

type ProductVariantInput = CreateProductVariantDto | UpdateProductVariantDto;

@Injectable()
export class ProductVariantService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
  ) {}

  /** Lấy variant đang bán cùng product và shop để định giá order. */
  async getOrderableVariants(ids: string[]): Promise<ProductVariant[]> {
    const variants = await this.variantRepository.find({
      where: { id: In(ids) },
      relations: { product: { shop: true } },
    });
    this.assertOrderableVariants(variants, ids.length);
    return variants;
  }

  /** Khóa các variant trong transaction, xác nhận giá và tồn kho hiện tại. */
  async lockOrderableVariants(
    manager: EntityManager,
    quantities: Map<string, number>,
    expectedVariants: ProductVariant[],
  ): Promise<ProductVariant[]> {
    const ids = [...quantities.keys()];
    const variants = await manager.getRepository(ProductVariant).find({
      where: { id: In(ids) },
      relations: { product: { shop: true } },
      lock: { mode: 'pessimistic_write' },
    });
    this.assertOrderableVariants(variants, ids.length);

    const expectedById = new Map(
      expectedVariants.map((variant) => [variant.id, variant]),
    );
    for (const variant of variants) {
      const expected = expectedById.get(variant.id);
      if (!expected || expected.price !== variant.price) {
        throw new BadRequestException(
          'Giá sản phẩm vừa thay đổi; vui lòng tạo lại đơn hàng.',
        );
      }
      if (variant.stock < quantities.get(variant.id)!) {
        throw new BadRequestException(
          `${variant.product.name} không đủ tồn kho; hiện còn ${variant.stock}.`,
        );
      }
    }
    return variants;
  }

  /** Trừ tồn kho cho variant đã khóa trong transaction của order. */
  async decreaseOrderStock(
    manager: EntityManager,
    variant: ProductVariant,
    quantity: number,
  ): Promise<void> {
    variant.stock -= quantity;
    await manager.getRepository(ProductVariant).save(variant);
  }

  private assertOrderableVariants(
    variants: ProductVariant[],
    expectedCount: number,
  ): void {
    if (variants.length !== expectedCount) {
      throw new NotFoundException(
        'Một hoặc nhiều biến thể sản phẩm không tồn tại.',
      );
    }
    for (const variant of variants) {
      if (
        variant.status !== ProductVariantStatus.ACTIVE ||
        variant.product.status !== ProductStatus.ACTIVE ||
        variant.product.is_deleted !== 0 ||
        variant.product.shop.status !== ShopStatus.ACTIVE
      ) {
        throw new BadRequestException(
          `Sản phẩm ${variant.product.name} hiện không thể đặt mua.`,
        );
      }
    }
  }

  /**
   * Trừ tồn kho sau khi thanh toán thành công.
   * Dùng EntityManager trong transaction của caller để các thay đổi chỉ được
   * commit cùng đơn hàng và được rollback nếu transaction gặp lỗi.
   */
  async update_quantity(
    manager: EntityManager,
    variant: ProductVariant,
    quantity: number,
  ): Promise<ProductVariant> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'Số lượng sản phẩm phải là số nguyên lớn hơn 0.',
      );
    }

    const repository = manager.getRepository(ProductVariant);
    const lockedVariant = await repository.findOne({
      where: { id: variant.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!lockedVariant) {
      throw new NotFoundException('Không tìm thấy biến thể sản phẩm.');
    }
    if (lockedVariant.stock < quantity) {
      throw new BadRequestException('Số lượng tồn kho không đủ.');
    }

    lockedVariant.stock -= quantity;
    return repository.save(lockedVariant);
  }

  /**
   * Tạo biến thể mới hoặc cập nhật biến thể đã có trong transaction của product.
   * Luồng mỗi biến thể: xác định create/update -> lưu trường SKU, giá, tồn kho,
   * trạng thái và ảnh -> nếu client gửi attributes thì thay các liên kết cũ
   * bằng giá trị thuộc tính đã xác thực theo danh mục.
   */
  async saveProductVariants(
    manager: EntityManager,
    product: Product,
    categoryId: string,
    inputs: ProductVariantInput[],
    variantImages: Map<number, CloudinaryUploadResult>,
  ): Promise<void> {
    const variants = manager.getRepository(ProductVariant);
    const links = manager.getRepository(VariantAttributeValue);

    for (const input of inputs) {
      let variant: ProductVariant;

      if ('id' in input && input.id) {
        const existing = await variants.findOne({
          where: { id: input.id, product_id: product.id },
        });
        if (!existing) {
          throw new NotFoundException(
            'Không tìm thấy biến thể thuộc sản phẩm này.',
          );
        }

        variant = existing;
        if (input.sku !== undefined) variant.sku = input.sku.trim();
        if (input.name !== undefined) variant.name = input.name?.trim() || null;
        if (input.price !== undefined) variant.price = input.price;
        if (input.stock !== undefined) variant.stock = input.stock;
        if (input.status !== undefined) variant.status = input.status;
      } else {
        if (!input.sku?.trim() || !input.price) {
          throw new BadRequestException('Biến thể mới cần có sku và price.');
        }
        variant = variants.create({
          product_id: product.id,
          product,
          sku: input.sku.trim(),
          name: input.name?.trim() || null,
          price: input.price,
          stock: input.stock ?? 0,
          status: input.status ?? ProductVariantStatus.ACTIVE,
        });
      }

      const uploadedImage = variantImages.get(input.image_file_index ?? -1);
      if (uploadedImage) variant.image_url = uploadedImage.secure_url;
      variant = await variants.save(variant);

      if (input.attributes !== undefined) {
        const attributeValueIds = await this.resolveAttributeValues(
          manager,
          categoryId,
          input.attributes,
        );
        await links.delete({ variant_id: variant.id });
        if (attributeValueIds.length > 0) {
          await links.save(
            attributeValueIds.map((attributeValueId) =>
              links.create({
                variant_id: variant.id,
                attribute_value_id: attributeValueId,
                variant,
              }),
            ),
          );
        }
      }
    }
  }

  /**
   * Kiểm tra thuộc tính thuộc danh mục, tái sử dụng hoặc tạo giá trị mới,
   * sau đó trả về các ID để liên kết với biến thể.
   */
  private async resolveAttributeValues(
    manager: EntityManager,
    categoryId: string,
    inputs: ProductVariantAttributeDto[],
  ): Promise<string[]> {
    const categoryAttributes = manager.getRepository(CategoryAttribute);
    const values = manager.getRepository(AttributeValues);
    const seenAttributes = new Set<string>();
    const result: string[] = [];

    for (const input of inputs) {
      const attributeId = input.attribute_id;
      const value = input.value.trim();
      if (!value) {
        throw new BadRequestException('Giá trị biến thể không được để trống.');
      }
      if (seenAttributes.has(attributeId)) {
        throw new BadRequestException(
          'Mỗi biến thể chỉ được chọn một giá trị cho từng thuộc tính.',
        );
      }
      seenAttributes.add(attributeId);

      const isAllowed = await categoryAttributes.exists({
        where: { category_id: categoryId, attribute_id: attributeId },
      });
      if (!isAllowed) {
        throw new BadRequestException(
          `Thuộc tính ${attributeId} không được cấu hình cho danh mục này.`,
        );
      }

      let attributeValue = await values.findOne({
        where: { attribute_id: attributeId, value },
      });
      if (!attributeValue) {
        attributeValue = await values.save(
          values.create({ attribute_id: attributeId, value }),
        );
      }
      result.push(attributeValue.id);
    }
    return result;
  }
}
