import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { VerifyProductDto } from './dto/verify-product.dto.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';
import { UserRole } from '../user/entities/enums/user.enum.js';
import type { Request } from 'express';
import { ApiResponseData } from '../dto/response.js';

@Controller('/api/v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @Patch('/verify-seller')
  async verifySeller(
    @Req() req: Request,
    @Param(`seller_id`) seller_id: string,
  ) {
    const response = await this.adminService.verifySeller(seller_id);
    return new ApiResponseData<any>(
      true,
      'Xác thực tài khoản thành công!',
      response,
      200,
    );
  }

  /** Admin duyệt ACTIVE hoặc từ chối REJECTED một sản phẩm theo ID. */
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @Patch('/products/:product_id/verify')
  async verifyProduct(
    @Param('product_id') productId: string,
    @Body() dto: VerifyProductDto,
  ) {
    const product = await this.adminService.verifyProduct(productId, dto);
    return new ApiResponseData(
      true,
      'Xử lý xác thực sản phẩm thành công.',
      product,
      200,
    );
  }
}
