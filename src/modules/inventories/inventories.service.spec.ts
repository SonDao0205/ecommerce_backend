import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InventoriesRepository,
  InventoryUpdateError,
} from './inventories.repository';
import { InventoriesService } from './inventories.service';
import { RedisCacheService } from '@common/cache/redis-cache.service';

describe('InventoriesService', () => {
  let service: InventoriesService;
  let repository: { updateStock: jest.Mock };

  beforeEach(async () => {
    repository = { updateStock: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoriesService,
        { provide: InventoriesRepository, useValue: repository },
        {
          provide: RedisCacheService,
          useValue: { increment: jest.fn().mockResolvedValue(1) },
        },
      ],
    }).compile();
    service = module.get(InventoriesService);
  });

  it('keeps the actor, expected stock and reason for each update', async () => {
    repository.updateStock.mockResolvedValue({ id: 'product-1', stock: 12 });
    await service.updateStock(
      'product-1',
      {
        variantId: 'variant-1',
        stock: 12,
        expectedStock: 10,
        reason: 'Nhập thêm từ nhà cung cấp',
      },
      'admin-1',
    );
    expect(repository.updateStock).toHaveBeenCalledWith('product-1', {
      variantId: 'variant-1',
      stock: 12,
      expectedStock: 10,
      reason: 'Nhập thêm từ nhà cung cấp',
      actorId: 'admin-1',
    });
  });

  it('returns conflict when a concurrent request used stale stock', async () => {
    repository.updateStock.mockRejectedValue(
      new InventoryUpdateError(
        'STALE_STOCK',
        'Tồn kho đã thay đổi từ 10 thành 12. Vui lòng tải lại dữ liệu!',
      ),
    );
    await expect(
      service.updateStock(
        'product-1',
        {
          stock: 15,
          expectedStock: 10,
          reason: 'Concurrency test request B',
        },
        'admin-2',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
