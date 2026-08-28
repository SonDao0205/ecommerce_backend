// src/modules/categories/categories.service.ts
import { Category } from '@entities';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { CategoriesRepository } from './categories.repository';
import { CategoryQueryDto } from './dto/category-query.dto';
import { RedisCacheService } from '@common/cache/redis-cache.service';
import { STOREFRONT_CATEGORIES_CACHE_KEY } from './category-cache.constants';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly cache: RedisCacheService,
  ) {}

  // 1. Lấy danh sách danh mục theo chuẩn getAll management
  async getAllCategories(
    query: CategoryQueryDto,
  ): Promise<PaginatedData<Category>> {
    return this.categoriesRepository.findPaginated(query);
  }

  // 2. Tạo danh mục mới
  async createCategories(
    dto: CreateCategoryDto,
    actorId?: string,
  ): Promise<Category> {
    const { name, slug, description, parentId } = dto;

    // 2.1 Kiểm tra trùng slug
    await this.slugExists(slug);

    // 2.2 Kiểm tra parentId
    if (parentId) {
      await this.parentExists(parentId);
    }

    // 2.3 Khởi tạo và lưu
    const category = this.categoriesRepository.create({
      name,
      slug,
      description: description || undefined,
      parentId: parentId || undefined,
    });

    const saved = await this.categoriesRepository.save(category, actorId);
    await this.invalidateStorefrontCache();
    return saved;
  }

  // 3. Cập nhật danh mục
  async updateCategory(
    dto: UpdateCategoryDto,
    id: string,
    actorId?: string,
  ): Promise<Category> {
    const { name, slug, description, parentId } = dto;
    const category = await this.findCategoryById(id);

    if (parentId && parentId === id) {
      throw new BadRequestException('Danh mục không thể làm cha của chính nó!');
    }

    if (slug && slug !== category.slug) {
      await this.slugExists(slug);
      category.slug = slug;
    }

    category.name = name;
    category.description = description || undefined;
    category.parentId = parentId || undefined;

    const saved = await this.categoriesRepository.save(category, actorId);
    await this.invalidateStorefrontCache();
    return saved;
  }

  // 4. Ẩn hoặc hiện danh mục
  async updateStatus(
    id: string,
    isActive: boolean,
    actorId?: string,
  ): Promise<Category> {
    const category = await this.findCategoryById(id);
    category.isActive = isActive;
    const saved = await this.categoriesRepository.save(category, actorId);
    await this.invalidateStorefrontCache();
    return saved;
  }

  // 5. Tìm theo ID (Đã sửa lỗi đệ quy)
  async findCategoryById(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);

    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục!');
    }

    return category;
  }

  async slugExists(slug: string): Promise<boolean> {
    const exist = await this.categoriesRepository.slugExists(slug);
    if (exist) throw new ConflictException('Đường dẫn SEO đã tồn tại!');
    return exist;
  }

  async parentExists(parentId: string): Promise<boolean> {
    const exists = await this.categoriesRepository.existsById(parentId);
    if (!exists) throw new NotFoundException('Không tìm thấy danh mục cha!');
    return exists;
  }

  private invalidateStorefrontCache(): Promise<void> {
    return this.cache.del(STOREFRONT_CATEGORIES_CACHE_KEY);
  }
}
