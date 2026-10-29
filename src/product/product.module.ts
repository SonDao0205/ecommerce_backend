import { Module } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { ProductVariantService } from './product-variant.service.js';
import { ProductController } from './product.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity.js';
import { ProductImage } from './entities/product_image.entity.js';
import { ProductVariant } from './entities/product_variant.entity.js';
import { VariantAttributeValue } from './entities/variant_attribute_value.entity.js';
import { Brand } from './entities/brand.entity.js';
import { Shop } from '../shop/entities/shop.entity.js';
import { Categories } from '../category/entities/categories.entity.js';
import { AttributeValues } from '../category/entities/attribute_values.entity.js';
import { ShopModule } from '../shop/shop.module.js';
import { CategoryModule } from '../category/category.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [
    ShopModule,
    CategoryModule,
    CloudinaryModule,
    UserModule,
    TypeOrmModule.forFeature([
      Product,
      ProductImage,
      ProductVariant,
      VariantAttributeValue,
      Brand,
      Shop,
      Categories,
      AttributeValues,
    ]),
  ],
  controllers: [ProductController],
  providers: [ProductService, ProductVariantService],
  exports: [ProductService],
})
export class ProductModule {}
