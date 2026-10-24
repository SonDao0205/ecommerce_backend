import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { VerifySellerDto } from './dto/verify-seller.dto.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { UserRole } from '../user/entities/enums/user.enum.js';
import type { Request } from 'express';
import { ApiResponseData } from '../dto/response.js';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, RolesGuard)
  @Patch('/verify-seller')
  async verifySeller(@Req() req: Request, @Body() dto: VerifySellerDto) {
    const response = await this.adminService.verifySeller(dto);
    return new ApiResponseData<any>(
      true,
      'Xác thực tài khoản thành công!',
      response,
      200,
    );
  }
}
