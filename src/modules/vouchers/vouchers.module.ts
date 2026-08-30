import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Voucher } from '@entities';
import { VouchersController } from './vouchers.controller';
import { VouchersRepository } from './vouchers.repository';
import { VouchersService } from './vouchers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Voucher])],
  controllers: [VouchersController],
  providers: [VouchersService, VouchersRepository],
})
export class VouchersModule {}
