import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { CategoriesRepository } from '../categories/categories.repository';
import { STOREFRONT_CATEGORIES_CACHE_KEY } from '../categories/category-cache.constants';
import { ProductsRepository } from '../products/products.repository';
import { StorefrontService } from './storefront.service';

describe('StorefrontService category cache', () => {
  let service: StorefrontService;
  let categoriesRepository: { findAllActive: jest.Mock };
  let cache: { rememberJson: jest.Mock };

  beforeEach(() => {
    categoriesRepository = { findAllActive: jest.fn() };
    cache = {
      rememberJson: jest.fn((_key, _ttl, loader) => loader()),
    };
    service = new StorefrontService(
      {} as ProductsRepository,
      categoriesRepository as unknown as CategoriesRepository,
      cache as unknown as RedisCacheService,
      { get: jest.fn().mockReturnValue(600) } as unknown as ConfigService,
    );
  });

  it('returns Redis data without calling the database on cache hit', async () => {
    const cached = [{ id: 'category-1', name: 'Điện thoại' }];
    cache.rememberJson.mockResolvedValue(cached);

    await expect(service.getCategories()).resolves.toEqual(cached);
    expect(cache.rememberJson).toHaveBeenCalledWith(
      STOREFRONT_CATEGORIES_CACHE_KEY,
      600,
      expect.any(Function),
    );
    expect(categoriesRepository.findAllActive).not.toHaveBeenCalled();
  });

  it('treats an empty cached list as a valid cache hit', async () => {
    cache.rememberJson.mockResolvedValue([]);

    await expect(service.getCategories()).resolves.toEqual([]);
    expect(categoriesRepository.findAllActive).not.toHaveBeenCalled();
  });

  it('loads from database and writes Redis with TTL on cache miss', async () => {
    const categories = [{ id: 'category-2', name: 'Laptop' }];
    categoriesRepository.findAllActive.mockResolvedValue(categories);

    await expect(service.getCategories()).resolves.toEqual(categories);
    expect(categoriesRepository.findAllActive).toHaveBeenCalledTimes(1);
    expect(cache.rememberJson).toHaveBeenCalledWith(
      STOREFRONT_CATEGORIES_CACHE_KEY,
      600,
      expect.any(Function),
    );
  });
});
