import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { SetCategoryDefaultAttributesDto } from './dto/set-category-default-attributes.dto.js';
import { ApiResponseData } from '../dto/response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { EmailVerifiedGuard } from '../middleware/guard/email-verified.guard.js';
import { Roles, RolesGuard } from '../middleware/guard/roles.guard.js';
import { UserRole } from '../user/entities/enums/user.enum.js';

@Controller('api/v1/admin/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @Post()
  async createCategory(@Body() dto: CreateCategoryDto) {
    const category = await this.categoryService.createCategory(dto);
    return new ApiResponseData(
      true,
      'Tạo danh mục thành công!',
      category,
      HttpStatus.CREATED,
    );
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard, EmailVerifiedGuard, RolesGuard)
  @Post(':categoryId/default-attributes')
  async setDefaultAttributes(
    @Param('categoryId') categoryId: string,
    @Body() dto: SetCategoryDefaultAttributesDto,
  ) {
    const data = await this.categoryService.setDefaultAttributes(
      categoryId,
      dto,
    );
    return new ApiResponseData(
      true,
      'Thiết lập thuộc tính biến thể mặc định cho danh mục thành công!',
      data,
      HttpStatus.CREATED,
    );
  }
}
