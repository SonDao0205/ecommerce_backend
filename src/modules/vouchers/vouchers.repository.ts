import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, ILike, QueryRunner } from 'typeorm';
import { Voucher } from '@entities';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { PaginatedData } from 'src/database/dtos/common/paginated_response.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';

export interface VoucherView extends Voucher {
  productIds: string[];
  categoryIds: string[];
  customerIds: string[];
  memberGroupIds: string[];
}

export interface VoucherCustomerOption {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}
export interface VoucherMemberGroupOption {
  id: string;
  name: string;
}

@Injectable()
export class VouchersRepository {
  constructor(private readonly dataSource: DataSource) {}

  getCustomerOptions(): Promise<VoucherCustomerOption[]> {
    return this.dataSource.query(
      `SELECT u.id, u.full_name AS name, u.email, u.phone
       FROM users u
       WHERE u.deleted_at IS NULL AND u.is_active = TRUE
         AND EXISTS (
           SELECT 1 FROM user_roles ur
           INNER JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.id AND ur.deleted_at IS NULL
             AND r.deleted_at IS NULL AND r.name = 'customer'
         )
       ORDER BY u.full_name ASC NULLS LAST, u.email ASC LIMIT 100`,
    );
  }

  getMemberGroupOptions(): Promise<VoucherMemberGroupOption[]> {
    return this.dataSource.query(
      `SELECT id, name FROM customer_groups ORDER BY name ASC LIMIT 100`,
    );
  }

  async findAll(query: VoucherQueryDto): Promise<PaginatedData<VoucherView>> {
    const filters: FindOptionsWhere<Voucher> = {};
    if (query.status) filters.status = query.status;
    if (query.discountType) filters.discountType = query.discountType;
    const where: FindOptionsWhere<Voucher> | FindOptionsWhere<Voucher>[] =
      query.search
        ? [
            { ...filters, name: ILike(`%${query.search}%`) },
            { ...filters, code: ILike(`%${query.search}%`) },
          ]
        : filters;
    const sortColumns: Record<string, keyof Voucher> = {
      name: 'name',
      code: 'code',
      startAt: 'startAt',
      endAt: 'endAt',
      usedCount: 'usedCount',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    };
    const [items, totalItems] = await this.dataSource
      .getRepository(Voucher)
      .findAndCount({
        where,
        order: { [sortColumns[query.sortBy] ?? 'createdAt']: query.sortOrder },
        take: query.limit,
        skip: query.skip,
      });
    const views = await Promise.all(
      items.map((item) => this.attachTargets(item)),
    );
    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit);
    return {
      items: views,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async findById(id: string): Promise<VoucherView | null> {
    const voucher = await this.dataSource
      .getRepository(Voucher)
      .findOne({ where: { id } });
    return voucher ? this.attachTargets(voucher) : null;
  }

  async create(dto: CreateVoucherDto, actorId: string): Promise<VoucherView> {
    const id = await this.persist(undefined, dto, actorId);
    return (await this.findById(id))!;
  }

  async update(
    id: string,
    dto: UpdateVoucherDto,
    actorId: string,
  ): Promise<VoucherView | null> {
    const existing = await this.dataSource
      .getRepository(Voucher)
      .findOne({ where: { id } });
    if (!existing) return null;
    await this.persist(existing, dto, actorId);
    return this.findById(id);
  }

  async updateStatus(
    id: string,
    status: Voucher['status'],
    actorId: string,
  ): Promise<VoucherView | null> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await setDatabaseAuditContext(runner, { actorId });
      const result = await runner.manager
        .getRepository(Voucher)
        .update({ id }, { status });
      await runner.commitTransaction();
      return result.affected ? this.findById(id) : null;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async persist(
    existing: Voucher | undefined,
    dto: CreateVoucherDto,
    actorId: string,
  ): Promise<string> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await setDatabaseAuditContext(runner, { actorId });
      const entity = runner.manager.create(Voucher, {
        ...(existing ?? {}),
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description || null,
        status: dto.status,
        voucherType: dto.voucherType,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        minimumOrderAmount: dto.minimumOrderAmount,
        scope: dto.scope,
        audience: dto.audience,
        startAt: dto.startAt,
        endAt: dto.endAt,
        issuedQuantity: dto.issuedQuantity ?? null,
        maxUsageCount: dto.maxUsageCount ?? null,
        usageLimitPerUser: dto.usageLimitPerUser,
        combinableWithVouchers: dto.combinableWithVouchers,
        combinableWithFlashSale: dto.combinableWithFlashSale,
        combinableWithPromotions: dto.combinableWithPromotions,
      });
      const saved = await runner.manager.save(entity);
      await this.replaceLinks(runner, saved.id!, dto);
      await runner.commitTransaction();
      return saved.id!;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async replaceLinks(
    runner: QueryRunner,
    voucherId: string,
    dto: CreateVoucherDto,
  ): Promise<void> {
    for (const table of [
      'voucher_products',
      'voucher_categories',
      'voucher_customers',
      'voucher_customer_groups',
    ]) {
      await runner.query(`DELETE FROM ${table} WHERE voucher_id = $1`, [
        voucherId,
      ]);
    }
    await this.insertLinks(
      runner,
      'voucher_products',
      'product_id',
      voucherId,
      dto.productIds,
    );
    await this.insertLinks(
      runner,
      'voucher_categories',
      'category_id',
      voucherId,
      dto.categoryIds,
    );
    await this.insertLinks(
      runner,
      'voucher_customers',
      'user_id',
      voucherId,
      dto.customerIds,
    );
    await this.insertLinks(
      runner,
      'voucher_customer_groups',
      'group_id',
      voucherId,
      dto.memberGroupIds,
    );
  }

  private async insertLinks(
    runner: QueryRunner,
    table: string,
    column: string,
    voucherId: string,
    ids?: string[],
  ): Promise<void> {
    for (const id of [...new Set(ids ?? [])])
      await runner.query(
        `INSERT INTO ${table} (voucher_id, ${column}) VALUES ($1, $2)`,
        [voucherId, id],
      );
  }

  private async attachTargets(voucher: Voucher): Promise<VoucherView> {
    const [products, categories, customers, groups] = await Promise.all([
      this.dataSource.query<Array<{ id: string }>>(
        `SELECT product_id AS id FROM voucher_products WHERE voucher_id = $1`,
        [voucher.id],
      ),
      this.dataSource.query<Array<{ id: string }>>(
        `SELECT category_id AS id FROM voucher_categories WHERE voucher_id = $1`,
        [voucher.id],
      ),
      this.dataSource.query<Array<{ id: string }>>(
        `SELECT user_id AS id FROM voucher_customers WHERE voucher_id = $1`,
        [voucher.id],
      ),
      this.dataSource.query<Array<{ id: string }>>(
        `SELECT group_id AS id FROM voucher_customer_groups WHERE voucher_id = $1`,
        [voucher.id],
      ),
    ]);
    return Object.assign(voucher, {
      productIds: products.map((row) => row.id),
      categoryIds: categories.map((row) => row.id),
      customerIds: customers.map((row) => row.id),
      memberGroupIds: groups.map((row) => row.id),
    });
  }
}
