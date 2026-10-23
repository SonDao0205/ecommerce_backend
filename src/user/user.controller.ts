import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { ApiResponseData } from '../dto/response.js';
import { UserResponse } from './dto/user.response.js';
import { UserRole } from './entities/enums/user.enum.js';

@Controller('api/v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  @Post('/user')
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
  @Post('/user/address')
  async createAddress(@Body() dto: any) {}
}
