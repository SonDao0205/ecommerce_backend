import { Module } from '@nestjs/common';
import { ShopService } from './shop.service.js';
import { ShopController } from './shop.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from './entities/shop.entity.js';
import { ShopFollower } from './entities/shop_follower.entity.js';
import { User } from '../user/entities/user.entity.js';
import { UserModule } from '../user/user.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';

@Module({
  imports: [
    UserModule,
    CloudinaryModule,
    TypeOrmModule.forFeature([Shop, ShopFollower, User]),
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
