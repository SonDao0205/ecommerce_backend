import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { ApiResponseData } from '../dto/response.js';
import { UserResponse } from './dto/user.response.js';
import { UserRole } from './entities/enums/user.enum.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { AddressResponse } from './dto/address.response.js';
import type { Request } from 'express';

@Controller('api/v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  @Post()
  async create(@Body() dto: CreateUserDto) {
    const response = await this.userService.createUser(dto);
    return new ApiResponseData<UserResponse>(
      true,
      'Tạo người dùng thành công!',
      response,
      201,
    );
  }

  @UseGuards(AuthGuard)
  @Post('/address')
  async createAddress(@Req() req: Request, @Body() dto: CreateAddressDto) {
    const userId = (req as any).user?.id as string;
    const response = await this.userService.createAddress(dto, userId);

    return new ApiResponseData<AddressResponse>(
      true,
      'Tạo hồ sơ địa chỉ thành công!',
      response,
      201,
    );
  }
}
