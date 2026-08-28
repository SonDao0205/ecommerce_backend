import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Put,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { Category, UserRoleEnum } from '@entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { UpdateStatusDto } from 'src/database/dtos/common/update_status.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Roles(UserRoleEnum.ADMIN)
  @Get()
  async getAllCategories(
    @Query() query: CategoryQueryDto,
  ): Promise<ApiResponseData<PaginatedData<Category>>> {
    return {
      status: true,
      message: 'Lấy danh sách danh mục thành công',
      data: await this.categoriesService.getAllCategories(query),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Post()
  async createCategories(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCategoryDto,
  ): Promise<ApiResponseData<Category>> {
    return {
      status: true,
      message: 'Tạo danh mục thành công',
      data: await this.categoriesService.createCategories(dto, req.user.id),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Put(':id')
  async updateCategory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateCategoryDto,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseData<Category>> {
    return {
      status: true,
      message: 'Cập nhật danh mục thành công!',
      data: await this.categoriesService.updateCategory(dto, id, req.user.id),
      code: 200,
    };
  }

  @Roles(UserRoleEnum.ADMIN)
  @Patch(':id/status')
  async updateCategoryStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<ApiResponseData<Category>> {
    return {
      status: true,
      message: dto.isActive
        ? 'Hiện danh mục thành công!'
        : 'Ẩn danh mục thành công!',
      data: await this.categoriesService.updateStatus(
        id,
        dto.isActive,
        req.user.id,
      ),
      code: 200,
    };
  }
}
