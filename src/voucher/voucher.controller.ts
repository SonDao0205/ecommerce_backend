import {
  Body,
  Controller,
  Delete,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { VoucherService } from './voucher.service.js';
import { CreateVoucherDto } from './dto/create-voucher.dto.js';
import { SetVoucherActiveDto } from './dto/set-voucher-active.dto.js';
import { UpdateVoucherDto } from './dto/update-voucher.dto.js';
import { ApiResponseData } from '../dto/response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { UserRole } from '../user/entities/enums/user.enum.js';
import { ApplyVouchersDto } from './dto/apply-vouchers.dto.js';

type VoucherRequest = Request & {
  user: { id: string; role: string };
};

@Controller('api/v1/vouchers')
@Roles(UserRole.ADMIN, UserRole.SELLER)
@UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Post('apply')
  @Roles(UserRole.CLIENT)
  async apply(@Req() request: VoucherRequest, @Body() dto: ApplyVouchersDto) {
    const result = await this.voucherService.applyVouchers(dto, request.user);
    return new ApiResponseData(
      true,
      'Áp dụng voucher thành công!',
      result,
      HttpStatus.OK,
    );
  }

  @Post()
  async create(@Req() request: VoucherRequest, @Body() dto: CreateVoucherDto) {
    const voucher = await this.voucherService.create(dto, request.user);
    return new ApiResponseData(
      true,
      'Tạo voucher thành công!',
      voucher,
      HttpStatus.CREATED,
    );
  }

  @Patch(':voucherId')
  async update(
    @Req() request: VoucherRequest,
    @Param('voucherId') voucherId: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    const voucher = await this.voucherService.update(
      voucherId,
      dto,
      request.user,
    );
    return new ApiResponseData(
      true,
      'Cập nhật voucher thành công!',
      voucher,
      HttpStatus.OK,
    );
  }

  @Patch(':voucherId/status')
  async setActive(
    @Req() request: VoucherRequest,
    @Param('voucherId') voucherId: string,
    @Body() dto: SetVoucherActiveDto,
  ) {
    const voucher = await this.voucherService.setActive(
      voucherId,
      dto,
      request.user,
    );
    return new ApiResponseData(
      true,
      dto.is_active ? 'Đã kích hoạt voucher.' : 'Đã ngừng kích hoạt voucher.',
      voucher,
      HttpStatus.OK,
    );
  }

  @Delete(':voucherId')
  async deactivate(
    @Req() request: VoucherRequest,
    @Param('voucherId') voucherId: string,
  ) {
    const voucher = await this.voucherService.deactivate(
      voucherId,
      request.user,
    );
    return new ApiResponseData(
      true,
      'Đã ngừng kích hoạt voucher.',
      voucher,
      HttpStatus.OK,
    );
  }
}
