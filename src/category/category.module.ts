import { Module } from '@nestjs/common';
import { CategoryService } from './category.service.js';
import { CategoryController } from './category.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categories } from './entities/categories.entity.js';
import { Attributes } from './entities/attributes.entity.js';
import { AttributeValues } from './entities/attribute_values.entity.js';
import { CategoryAttribute } from './entities/category_attribute.entity.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([
      Categories,
      Attributes,
      AttributeValues,
      CategoryAttribute,
    ]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
