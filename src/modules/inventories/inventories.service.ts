import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { InventoryLogQueryDto } from './dto/inventory-log-query.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { UpdateInventoryStockDto } from './dto/update-inventory-stock.dto';
import {
  InventoriesRepository,
  InventoryLogView,
  InventoryProductView,
  InventoryUpdateError,
} from './inventories.repository';

@Injectable()
export class InventoriesService {
  constructor(private readonly inventoriesRepository: InventoriesRepository) {}

  getAll(
    query: InventoryQueryDto,
  ): Promise<PaginatedData<InventoryProductView>> {
    return this.inventoriesRepository.findAll(query);
  }

  getLogs(
    productId: string,
    query: InventoryLogQueryDto,
  ): Promise<InventoryLogView[]> {
    return this.inventoriesRepository.findLogs(
      productId,
      query.limit,
      query.variantId,
    );
  }

  async updateStock(
    productId: string,
    dto: UpdateInventoryStockDto,
    actorId: string,
  ): Promise<InventoryProductView> {
    try {
      return await this.inventoriesRepository.updateStock(productId, {
        variantId: dto.variantId,
        stock: dto.stock,
        expectedStock: dto.expectedStock,
        reason: dto.reason,
        actorId,
      });
    } catch (error) {
      if (!(error instanceof InventoryUpdateError)) throw error;
      if (
        error.code === 'PRODUCT_NOT_FOUND' ||
        error.code === 'INVENTORY_NOT_FOUND' ||
        error.code === 'VARIANT_NOT_FOUND'
      ) {
        throw new NotFoundException(error.message);
      }
      if (error.code === 'STALE_STOCK')
        throw new ConflictException(error.message);
      throw new BadRequestException(error.message);
    }
  }
}
