import { Module } from '@nestjs/common';
import { ShopService } from './shop.service.js';
import { ShopController } from './shop.controller.js';

@Module({
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
