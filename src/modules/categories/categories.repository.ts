import { Injectable } from '@nestjs/common';
import { Category } from '@entities';
import { DataSource } from 'typeorm';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { createPaginatedData } from '@common/pagination/create_paginated_data';
import { CategoryQueryDto } from './dto/category-query.dto';
import { SortOrder } from 'src/database/dtos/common/get_all.dto';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { extractPostgresRows } from '@common/database/postgres-query-result';

interface RawCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  parent_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  parent_name?: string | null;
  parent_slug?: string | null;
  parent_is_active?: boolean | null;
  child_count?: number | string;
  total_count?: number | string;
}

interface ExistsRow {
  exists: boolean;
}

@Injectable()
export class CategoriesRepository {
  private readonly sortColumns: Record<string, string> = {
    name: 'c.name',
    slug: 'c.slug',
    createdAt: 'c.created_at',
    updatedAt: 'c.updated_at',
  };

  constructor(private readonly dataSource: DataSource) {}

  async findAllActive(): Promise<Category[]> {
    const rows = await this.dataSource.query<RawCategoryRow[]>(
      `SELECT id, name, slug, description, is_active, parent_id,
              created_at, updated_at, deleted_at
       FROM categories
       WHERE is_active = TRUE AND deleted_at IS NULL
       ORDER BY parent_id NULLS FIRST, name ASC`,
    );
    return rows.map((row) => this.mapCategory(row));
  }

  async findPaginated(
    query: CategoryQueryDto,
  ): Promise<PaginatedData<Category>> {
    const parameters: unknown[] = [];
    const conditions = ['c.deleted_at IS NULL'];
    const addParameter = (value: unknown) => {
      parameters.push(value);
      return `$${parameters.length}`;
    };

    if (query.search) {
      const placeholder = addParameter(`%${query.search}%`);
      conditions.push(
        `(c.name ILIKE ${placeholder} OR c.slug ILIKE ${placeholder})`,
      );
    }
    if (typeof query.isActive === 'boolean') {
      conditions.push(`c.is_active = ${addParameter(query.isActive)}`);
    }
    if (query.parentId) {
      conditions.push(`c.parent_id = ${addParameter(query.parentId)}`);
    } else if (query.rootOnly) {
      conditions.push('c.parent_id IS NULL');
    }

    let childActiveCondition = '';
    if (typeof query.isActive === 'boolean') {
      childActiveCondition = ` AND child.is_active = ${addParameter(query.isActive)}`;
    }

    const limitPlaceholder = addParameter(query.limit);
    const offsetPlaceholder = addParameter(query.skip);
    const sortColumn = this.sortColumns[query.sortBy] ?? 'c.created_at';
    const sortOrder = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';

    const rows = await this.dataSource.query<RawCategoryRow[]>(
      `SELECT
         c.id, c.name, c.slug, c.description, c.is_active, c.parent_id,
         c.created_at, c.updated_at, c.deleted_at,
         p.name AS parent_name, p.slug AS parent_slug,
         p.is_active AS parent_is_active,
         (
           SELECT COUNT(child.id)
           FROM categories child
           WHERE child.parent_id = c.id
             AND child.deleted_at IS NULL
             ${childActiveCondition}
         ) AS child_count,
         COUNT(*) OVER() AS total_count
       FROM categories c
       LEFT JOIN categories p ON p.id = c.parent_id AND p.deleted_at IS NULL
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      parameters,
    );

    const items = rows.map((row) => this.mapCategory(row));
    const totalItems = Number(rows[0]?.total_count ?? 0);
    return createPaginatedData(items, totalItems, query.page, query.limit);
  }

  create(data: Partial<Category>): Category {
    return Object.assign(new Category(), data);
  }

  async save(category: Category, actorId?: string): Promise<Category> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId });
      if (category.id) {
        const result: unknown = await queryRunner.query(
          `UPDATE categories
         SET name = $2,
             slug = $3,
             description = $4,
             parent_id = $5,
             is_active = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, name, slug, description, is_active, parent_id,
                   created_at, updated_at, deleted_at`,
          [
            category.id,
            category.name,
            category.slug,
            category.description ?? null,
            category.parentId ?? null,
            category.isActive ?? true,
          ],
        );
        const rows = extractPostgresRows<RawCategoryRow>(result);
        const row = rows[0];
        if (!row) throw new Error('Không thể cập nhật danh mục');
        await queryRunner.commitTransaction();
        return this.mapCategory(row);
      }

      const rows = (await queryRunner.query(
        `INSERT INTO categories (name, slug, description, parent_id, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, slug, description, is_active, parent_id,
                 created_at, updated_at, deleted_at`,
        [
          category.name,
          category.slug,
          category.description ?? null,
          category.parentId ?? null,
          category.isActive ?? true,
        ],
      )) as unknown as RawCategoryRow[];
      const row = rows[0];
      if (!row) throw new Error('Không thể tạo danh mục');
      await queryRunner.commitTransaction();
      return this.mapCategory(row);
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<Category | null> {
    const [row] = await this.dataSource.query<RawCategoryRow[]>(
      `SELECT id, name, slug, description, is_active, parent_id,
              created_at, updated_at, deleted_at
       FROM categories
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return row ? this.mapCategory(row) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const [row] = await this.dataSource.query<ExistsRow[]>(
      `SELECT EXISTS(
         SELECT 1 FROM categories
         WHERE LOWER(slug) = LOWER($1) AND deleted_at IS NULL
       ) AS "exists"`,
      [slug],
    );
    return row?.exists ?? false;
  }

  async existsById(id: string): Promise<boolean> {
    const [row] = await this.dataSource.query<ExistsRow[]>(
      `SELECT EXISTS(
         SELECT 1 FROM categories
         WHERE id = $1 AND deleted_at IS NULL
       ) AS "exists"`,
      [id],
    );
    return row?.exists ?? false;
  }

  private mapCategory(row: RawCategoryRow): Category {
    const parent = row.parent_id
      ? Object.assign(new Category(), {
          id: row.parent_id,
          name: row.parent_name ?? undefined,
          slug: row.parent_slug ?? undefined,
          isActive: row.parent_is_active ?? undefined,
        })
      : undefined;
    return Object.assign(new Category(), {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      isActive: row.is_active,
      parentId: row.parent_id,
      parent,
      childCount: Number(row.child_count ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }
}
