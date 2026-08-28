import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRoleEnum } from '@entities';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService, DashboardView } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  async getDashboard(
    @Query() query: DashboardQueryDto,
  ): Promise<ApiResponseData<DashboardView>> {
    return {
      status: true,
      message: 'Lấy dữ liệu dashboard thành công!',
      data: await this.service.getDashboard(query),
      code: 200,
    };
  }
}
