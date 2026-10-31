import { Module } from '@nestjs/common';
import { VoucherService } from './voucher.service.js';
import { VoucherController } from './voucher.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Voucher } from './entities/voucher.entity.js';
import { ShopModule } from '../shop/shop.module.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher]), ShopModule, UserModule],
  controllers: [VoucherController],
  providers: [VoucherService],
  exports: [VoucherService],
})
export class VoucherModule {}
