import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';
import { RedisCacheService } from '@common/cache/redis-cache.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repository: { findById: jest.Mock; save: jest.Mock };
  let cache: { del: jest.Mock };

  beforeEach(async () => {
    repository = { findById: jest.fn(), save: jest.fn() };
    cache = { del: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: CategoriesRepository,
          useValue: repository,
        },
        {
          provide: RedisCacheService,
          useValue: cache,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('invalidates storefront categories after a successful status update', async () => {
    const category = { id: 'category-1', isActive: true };
    repository.findById.mockResolvedValue(category);
    repository.save.mockResolvedValue({ ...category, isActive: false });

    await service.updateStatus('category-1', false, 'admin-1');

    expect(repository.save).toHaveBeenCalledWith(
      { id: 'category-1', isActive: false },
      'admin-1',
    );
    expect(cache.del).toHaveBeenCalledWith('storefront:categories:active:v1');
  });

  it('does not invalidate cache when database persistence fails', async () => {
    repository.findById.mockResolvedValue({
      id: 'category-1',
      isActive: true,
    });
    repository.save.mockRejectedValue(new Error('database failed'));

    await expect(
      service.updateStatus('category-1', false, 'admin-1'),
    ).rejects.toThrow('database failed');
    expect(cache.del).not.toHaveBeenCalled();
  });
});
