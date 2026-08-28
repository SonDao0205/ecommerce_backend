import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category, Product, ProductVariant } from '@entities';
import { ProductsRepository } from './products.repository';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category, ProductVariant]),
    CloudinaryModule,
  ],
  providers: [ProductsService, ProductsRepository],
  controllers: [ProductsController],
  exports: [ProductsRepository],
})
export class ProductsModule {}
