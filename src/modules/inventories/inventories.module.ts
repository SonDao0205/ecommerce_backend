import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Inventory,
  InventoryTransaction,
  Product,
  ProductVariant,
  User,
} from '@entities';
import { InventoriesController } from './inventories.controller';
import { InventoriesRepository } from './inventories.repository';
import { InventoriesService } from './inventories.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inventory,
      InventoryTransaction,
      Product,
      ProductVariant,
      User,
    ]),
  ],
  controllers: [InventoriesController],
  providers: [InventoriesService, InventoriesRepository],
})
export class InventoriesModule {}
