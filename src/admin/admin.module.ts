import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity.js';
import { UserModule } from '../user/user.module.js';
import { ProductModule } from '../product/product.module.js';

@Module({
  imports: [UserModule, ProductModule, TypeOrmModule.forFeature([User])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
