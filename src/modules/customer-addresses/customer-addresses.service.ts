import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from './dto/customer-address.dto';
import {
  CustomerAddressesRepository,
  CustomerAddressView,
} from './customer-addresses.repository';

@Injectable()
export class CustomerAddressesService {
  constructor(private readonly repository: CustomerAddressesRepository) {}

  findAll(userId: string): Promise<CustomerAddressView[]> {
    return this.repository.findAllByUser(userId);
  }

  findDefault(userId: string): Promise<CustomerAddressView | null> {
    return this.repository.findDefaultByUser(userId);
  }

  create(
    userId: string,
    dto: CreateCustomerAddressDto,
  ): Promise<CustomerAddressView> {
    return this.repository.create(userId, dto);
  }

  saveDefault(
    userId: string,
    dto: CreateCustomerAddressDto,
  ): Promise<CustomerAddressView> {
    return this.repository.saveDefault(userId, dto);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateCustomerAddressDto,
  ): Promise<CustomerAddressView> {
    const address = await this.repository.update(id, userId, dto);
    if (!address) throw new NotFoundException('Không tìm thấy địa chỉ');
    return address;
  }

  async remove(id: string, userId: string): Promise<void> {
    if (!(await this.repository.remove(id, userId))) {
      throw new NotFoundException('Không tìm thấy địa chỉ');
    }
  }
}
