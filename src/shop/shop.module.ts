import { Module } from '@nestjs/common';
import { ShopService } from './shop.service.js';
import { ShopController } from './shop.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from './entities/shop.entity.js';
import { ShopFollower } from './entities/shop_follower.entity.js';
import { ShopOrder } from './entities/shop_order.entity.js';
import { User } from '../user/entities/user.entity.js';
import { UserModule } from '../user/user.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { ElasticModule } from '../elastic/elastic.module.js';

@Module({
  imports: [
    UserModule,
    CloudinaryModule,
    ElasticModule,
    TypeOrmModule.forFeature([Shop, ShopFollower, ShopOrder, User]),
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
