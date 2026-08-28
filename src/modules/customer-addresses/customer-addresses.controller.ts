import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from './dto/customer-address.dto';
import { CustomerAddressView } from './customer-addresses.repository';
import { CustomerAddressesService } from './customer-addresses.service';

@UseGuards(JwtAuthGuard)
@Controller('customer-addresses')
export class CustomerAddressesController {
  constructor(private readonly service: CustomerAddressesService) {}

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseData<CustomerAddressView[]>> {
    return {
      status: true,
      message: 'Lấy danh sách địa chỉ thành công!',
      data: await this.service.findAll(req.user.id!),
      code: 200,
    };
  }

  @Get('default')
  async findDefault(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseData<CustomerAddressView | null>> {
    return {
      status: true,
      message: 'Lấy địa chỉ mặc định thành công!',
      data: await this.service.findDefault(req.user.id!),
      code: 200,
    };
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomerAddressDto,
  ): Promise<ApiResponseData<CustomerAddressView>> {
    return {
      status: true,
      message: 'Lưu địa chỉ thành công!',
      data: await this.service.create(req.user.id!, dto),
      code: 201,
    };
  }

  @Patch('default')
  async saveDefault(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCustomerAddressDto,
  ): Promise<ApiResponseData<CustomerAddressView>> {
    return {
      status: true,
      message: 'Lưu hồ sơ giao hàng mặc định thành công!',
      data: await this.service.saveDefault(req.user.id!, dto),
      code: 200,
    };
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerAddressDto,
  ): Promise<ApiResponseData<CustomerAddressView>> {
    return {
      status: true,
      message: 'Cập nhật địa chỉ thành công!',
      data: await this.service.update(id, req.user.id!, dto),
      code: 200,
    };
  }

  @Patch(':id/default')
  async setDefault(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseData<CustomerAddressView>> {
    return {
      status: true,
      message: 'Đã đặt làm địa chỉ mặc định!',
      data: await this.service.update(id, req.user.id!, { isDefault: true }),
      code: 200,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.service.remove(id, req.user.id!);
  }
}
