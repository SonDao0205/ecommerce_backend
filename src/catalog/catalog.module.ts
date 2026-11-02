import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CatalogController } from './catalog.controller.js';
import { ProductModule } from '../product/product.module.js';

@Module({
  imports: [ProductModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
