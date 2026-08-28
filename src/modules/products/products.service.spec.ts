import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Product } from '@entities';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { RedisCacheService } from '@common/cache/redis-cache.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepository: {
    productSkuExists: jest.Mock;
    variantSkusExisting: jest.Mock;
    productSkusExisting: jest.Mock;
    create: jest.Mock;
    saveWithVariants: jest.Mock;
    updateWithVariants: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(async () => {
    productsRepository = {
      productSkuExists: jest.fn().mockResolvedValue(false),
      variantSkusExisting: jest.fn().mockResolvedValue([]),
      productSkusExisting: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockImplementation((data: Partial<Product>) =>
          Object.assign(new Product(), data),
        ),
      saveWithVariants: jest
        .fn()
        .mockImplementation((product: Product) => Promise.resolve(product)),
      updateWithVariants: jest
        .fn()
        .mockImplementation((product: Product) => Promise.resolve(product)),
      findById: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: productsRepository,
        },
        {
          provide: RedisCacheService,
          useValue: { increment: jest.fn().mockResolvedValue(1) },
        },
        {
          provide: CloudinaryService,
          useValue: {
            uploadImages: jest.fn().mockResolvedValue([]),
            removeImages: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('requires product stock when there are no variants', async () => {
    await expect(service.createProduct(productDto(), [])).rejects.toThrow(
      'Sản phẩm không có biến thể phải nhập tồn kho',
    );
  });

  it('saves product stock directly when there are no variants', async () => {
    await service.createProduct(productDto({ stock: 12 }), []);

    expect(productsRepository.saveWithVariants).toHaveBeenCalledWith(
      expect.any(Product),
      [],
      12,
    );
  });

  it('calculates inventory from all child variants', async () => {
    const variants = [
      {
        name: 'Màu sắc',
        value: 'Đen',
        children: [
          {
            name: 'Dung lượng',
            value: '128 GB',
            sku: 'TEST-BLK-128',
            unitPrice: 100000,
            stock: 4,
          },
          {
            name: 'Dung lượng',
            value: '256 GB',
            sku: 'TEST-BLK-256',
            unitPrice: 120000,
            stock: 7,
          },
        ],
      },
    ];

    await service.createProduct(
      productDto({ variants: JSON.stringify(variants) }),
      [],
    );

    expect(productsRepository.saveWithVariants).toHaveBeenCalledWith(
      expect.any(Product),
      variants,
      11,
    );
  });

  it('does not accept stale variant stock from the product update form', async () => {
    const existing = Object.assign(new Product(), {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Sản phẩm kiểm thử',
      slug: 'san-pham-kiem-thu',
      description: '<p>Mô tả kiểm thử</p>',
      sku: 'TEST-PRODUCT',
      unitPrice: 100000,
      stock: 4,
      variants: [],
    });
    productsRepository.findById.mockResolvedValue(existing);
    const variants = [
      {
        id: '20000000-0000-4000-8000-000000000001',
        name: 'Màu sắc',
        value: 'Đen',
        children: [
          {
            id: '30000000-0000-4000-8000-000000000001',
            name: 'Dung lượng',
            value: '256 GB',
            sku: 'TEST-BLK-256',
            unitPrice: 120000,
            stock: 999,
          },
        ],
      },
    ];

    await service.updateProduct(
      existing.id,
      updateDto({ variants: JSON.stringify(variants) }),
      [],
    );

    expect(productsRepository.updateWithVariants).toHaveBeenCalledWith(
      expect.any(Product),
      [
        expect.objectContaining({
          children: [expect.objectContaining({ stock: 0 })],
        }),
      ],
    );
  });
});

function productDto(
  overrides: Partial<CreateProductDto> = {},
): CreateProductDto {
  return {
    name: 'Sản phẩm kiểm thử',
    slug: 'san-pham-kiem-thu',
    description: '<p>Mô tả kiểm thử</p>',
    sku: 'TEST-PRODUCT',
    unitPrice: 100000,
    ...overrides,
  };
}

function updateDto(
  overrides: Partial<UpdateProductDto> = {},
): UpdateProductDto {
  return {
    name: 'Sản phẩm kiểm thử',
    slug: 'san-pham-kiem-thu',
    description: '<p>Mô tả kiểm thử</p>',
    sku: 'TEST-PRODUCT',
    unitPrice: 100000,
    ...overrides,
  };
}
