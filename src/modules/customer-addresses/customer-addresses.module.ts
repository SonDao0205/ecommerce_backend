import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerAddress } from '@entities';
import { CustomerAddressesController } from './customer-addresses.controller';
import { CustomerAddressesRepository } from './customer-addresses.repository';
import { CustomerAddressesService } from './customer-addresses.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerAddress])],
  controllers: [CustomerAddressesController],
  providers: [CustomerAddressesService, CustomerAddressesRepository],
  exports: [CustomerAddressesService],
})
export class CustomerAddressesModule {}
