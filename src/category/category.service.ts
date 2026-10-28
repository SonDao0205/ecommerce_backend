import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Categories } from './entities/categories.entity.js';
import { Attributes } from './entities/attributes.entity.js';
import { Repository } from 'typeorm';
import { CategoryAttribute } from './entities/category_attribute.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { SetCategoryDefaultAttributesDto } from './dto/set-category-default-attributes.dto.js';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Categories)
    private readonly categoriesRepository: Repository<Categories>,
    private readonly dataSource: DataSource,
  ) {}

  findById = async (id: string) => {
    return await this.categoriesRepository.findOne({
      where: {
        id: id,
      },
    });
  };

  createCategory = async (dto: CreateCategoryDto) => {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Tên danh mục không được để trống.');

    const slug = this.slugify(dto.slug?.trim() || name);
    if (!slug) {
      throw new BadRequestException('Không thể tạo slug từ tên danh mục này.');
    }

    const existing = await this.categoriesRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException('Slug danh mục đã tồn tại.');
    }

    let parent: Categories | null = null;
    if (dto.parent_id !== undefined) {
      parent = await this.findById(dto.parent_id);
      if (!parent) throw new NotFoundException('Không tìm thấy danh mục cha.');
    }

    const category = this.categoriesRepository.create({
      name,
      slug,
      parent_id: parent?.id ?? null,
      parent,
      image_url: dto.image_url?.trim() || null,
      sort_order: dto.sort_order ?? 0,
      is_active: dto.is_active ?? 1,
    });

    try {
      return await this.categoriesRepository.save(category);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Slug danh mục đã tồn tại.');
      }
      throw error;
    }
  };

  setDefaultAttributes = async (
    categoryId: string,
    dto: SetCategoryDefaultAttributesDto,
  ) => {
    if (!/^\d+$/.test(categoryId)) {
      throw new BadRequestException('ID danh mục không hợp lệ.');
    }

    return this.dataSource.transaction(async (manager) => {
      const categories = manager.getRepository(Categories);
      const attributes = manager.getRepository(Attributes);
      const categoryAttributes = manager.getRepository(CategoryAttribute);

      const category = await categories.findOne({
        where: { id: categoryId },
      });
      if (!category) throw new NotFoundException('Không tìm thấy danh mục.');

      const seenAttributeNames = new Set<string>();
      const result: Array<{ id: string; name: string }> = [];

      for (const input of dto.attributes) {
        const name = input.name.trim();
        if (!name) {
          throw new BadRequestException('Tên thuộc tính không được để trống.');
        }

        const normalizedName = name.toLocaleLowerCase();
        if (seenAttributeNames.has(normalizedName)) {
          throw new BadRequestException(
            `Thuộc tính "${name}" bị lặp trong yêu cầu.`,
          );
        }
        seenAttributeNames.add(normalizedName);

        let attribute = await attributes.findOne({ where: { name } });
        if (!attribute) {
          attribute = await attributes.save(attributes.create({ name }));
        }

        const assignment = await categoryAttributes.findOne({
          where: {
            category_id: category.id,
            attribute_id: attribute.id,
          },
        });
        if (!assignment) {
          await categoryAttributes.save(
            categoryAttributes.create({
              category_id: category.id,
              attribute_id: attribute.id,
              category,
              attribute,
            }),
          );
        }

        result.push({
          id: attribute.id,
          name: attribute.name,
        });
      }

      return {
        category_id: category.id,
        attributes: result,
      };
    });
  };

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, (letter) => (letter === 'đ' ? 'd' : 'D'))
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
