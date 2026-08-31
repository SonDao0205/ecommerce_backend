import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRoleEnum } from '@entities';
import { Roles } from '@common/decorators/roles.decorator';
import { RateLimit } from '@common/rate-limit/rate-limit.decorator';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ManagementReviewQueryDto,
  ProductReviewQueryDto,
  ReplyReviewDto,
} from './dto/review-query.dto';
import { ProductReviewPage, ReviewView } from './reviews.repository';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Get('products/:slug')
  @RateLimit({ limit: 120, windowSeconds: 60, keyPrefix: 'reviews:public' })
  async productReviews(
    @Param('slug') slug: string,
    @Query() query: ProductReviewQueryDto,
  ): Promise<ApiResponseData<ProductReviewPage>> {
    return {
      status: true,
      message: 'Lấy đánh giá sản phẩm thành công!',
      data: await this.service.getProductReviews(slug, query),
      code: 200,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.CUSTOMER)
  @Post()
  @RateLimit({
    limit: 10,
    windowSeconds: 60,
    scope: 'identity',
    keyPrefix: 'reviews:create',
  })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateReviewDto,
  ): Promise<ApiResponseData<ReviewView>> {
    return {
      status: true,
      message: 'Đánh giá sản phẩm thành công!',
      data: await this.service.create(req.user.id!, dto),
      code: 201,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Get('management')
  async management(
    @Query() query: ManagementReviewQueryDto,
  ): Promise<ApiResponseData<PaginatedData<ReviewView>>> {
    return {
      status: true,
      message: 'Lấy danh sách đánh giá thành công!',
      data: await this.service.getManagement(query),
      code: 200,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN)
  @Patch('management/:id/reply')
  async reply(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyReviewDto,
  ): Promise<ApiResponseData<ReviewView>> {
    return {
      status: true,
      message: 'Phản hồi đánh giá thành công!',
      data: await this.service.reply(id, dto.reply, req.user.id!),
      code: 200,
    };
  }
}
