import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service.js';
import { ShippingController } from './shipping.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingMethod } from './entities/shipping.entity.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [UserModule, TypeOrmModule.forFeature([ShippingMethod])],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
