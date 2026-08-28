import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRoleEnum } from '@entities';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiResponseData } from 'src/database/dtos/common/api_respone_data';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryLogQueryDto } from './dto/inventory-log-query.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { UpdateInventoryStockDto } from './dto/update-inventory-stock.dto';
import {
  InventoryLogView,
  InventoryProductView,
} from './inventories.repository';
import { InventoriesService } from './inventories.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.WAREHOUSE)
@Controller('inventories')
export class InventoriesController {
  constructor(private readonly inventoriesService: InventoriesService) {}

  @Get()
  async getAll(
    @Query() query: InventoryQueryDto,
  ): Promise<ApiResponseData<PaginatedData<InventoryProductView>>> {
    return {
      status: true,
      message: 'Lấy danh sách tồn kho thành công!',
      data: await this.inventoriesService.getAll(query),
      code: 200,
    };
  }

  @Get(':productId/logs')
  async getLogs(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: InventoryLogQueryDto,
  ): Promise<ApiResponseData<InventoryLogView[]>> {
    return {
      status: true,
      message: 'Lấy lịch sử tồn kho thành công!',
      data: await this.inventoriesService.getLogs(productId, query),
      code: 200,
    };
  }

  @Patch(':productId/stock')
  async updateStock(
    @Req() req: AuthenticatedRequest,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateInventoryStockDto,
  ): Promise<ApiResponseData<InventoryProductView>> {
    return {
      status: true,
      message: 'Cập nhật tồn kho thành công!',
      data: await this.inventoriesService.updateStock(
        productId,
        dto,
        req.user.id!,
      ),
      code: 200,
    };
  }
}
