import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRoleEnum } from '@entities';
import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { VouchersService } from './vouchers.service';
import { VoucherQueryDto } from './dto/voucher-query.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { UpdateVoucherStatusDto } from './dto/update-voucher-status.dto';
import {
  VoucherCustomerOption,
  VoucherMemberGroupOption,
  VoucherView,
} from './vouchers.repository';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly service: VouchersService) {}

  @Roles(UserRoleEnum.ADMIN)
  @Get()
  async findAll(
    @Query() query: VoucherQueryDto,
  ): Promise<ApiResponseData<PaginatedData<VoucherView>>> {
    return {
      status: true,
      message: 'Lấy danh sách voucher thành công!',
      data: await this.service.findAll(query),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Get('options/customers')
  async getCustomerOptions(): Promise<
    ApiResponseData<VoucherCustomerOption[]>
  > {
    return {
      status: true,
      message: 'Lấy danh sách khách hàng thành công!',
      data: await this.service.getCustomerOptions(),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Get('options/member-groups')
  async getMemberGroupOptions(): Promise<
    ApiResponseData<VoucherMemberGroupOption[]>
  > {
    return {
      status: true,
      message: 'Lấy danh sách nhóm thành viên thành công!',
      data: await this.service.getMemberGroupOptions(),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseData<VoucherView>> {
    return {
      status: true,
      message: 'Lấy chi tiết voucher thành công!',
      data: await this.service.findById(id),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateVoucherDto,
  ): Promise<ApiResponseData<VoucherView>> {
    return {
      status: true,
      message: 'Tạo voucher thành công!',
      data: await this.service.create(dto, req.user.id!),
      code: 201,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Put(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVoucherDto,
  ): Promise<ApiResponseData<VoucherView>> {
    return {
      status: true,
      message: 'Cập nhật voucher thành công!',
      data: await this.service.update(id, dto, req.user.id!),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVoucherStatusDto,
  ): Promise<ApiResponseData<VoucherView>> {
    return {
      status: true,
      message: 'Cập nhật trạng thái voucher thành công!',
      data: await this.service.updateStatus(id, dto.status, req.user.id!),
      code: 200,
    };
  }
}
