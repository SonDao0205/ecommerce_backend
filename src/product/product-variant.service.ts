import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CategoryAttribute } from '../category/entities/category_attribute.entity.js';
import { AttributeValues } from '../category/entities/attribute_values.entity.js';
import type { CloudinaryUploadResult } from '../cloudinary/cloudinary.service.js';
import { Product } from './entities/product.entity.js';
import { ProductVariant } from './entities/product_variant.entity.js';
import { VariantAttributeValue } from './entities/variant_attribute_value.entity.js';
import { ProductVariantStatus } from './entities/enum/product.enum.js';
import {
  CreateProductVariantDto,
  ProductVariantAttributeDto,
  UpdateProductVariantDto,
} from './dto/product-variant.dto.js';

type ProductVariantInput =
  | CreateProductVariantDto
  | UpdateProductVariantDto;

@Injectable()
export class ProductVariantService {
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
