import { Injectable } from '@nestjs/common';
import { setDatabaseAuditContext } from '@common/database/database-audit-context';
import { extractPostgresRows } from '@common/database/postgres-query-result';
import { DataSource, QueryRunner } from 'typeorm';

export interface CustomerAddressView {
  id: string;
  userId: string;
  recipientName: string;
  phone: string;
  email: string | null;
  address: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddressInput {
  recipientName: string;
  phone: string;
  email?: string;
  address: string;
  isDefault?: boolean;
}

interface RawCustomerAddress {
  id: string;
  user_id: string;
  recipient_name: string;
  phone: string;
  email: string | null;
  address: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class CustomerAddressesRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findAllByUser(userId: string): Promise<CustomerAddressView[]> {
    const rows = await this.dataSource.query<RawCustomerAddress[]>(
      `${this.selectSql}
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY is_default DESC, updated_at DESC`,
      [userId],
    );
    return rows.map((row) => this.map(row));
  }

  async findDefaultByUser(userId: string): Promise<CustomerAddressView | null> {
    const [row] = await this.dataSource.query<RawCustomerAddress[]>(
      `${this.selectSql}
       WHERE user_id = $1 AND is_default = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    return row ? this.map(row) : null;
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<CustomerAddressView | null> {
    const [row] = await this.dataSource.query<RawCustomerAddress[]>(
      `${this.selectSql}
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [id, userId],
    );
    return row ? this.map(row) : null;
  }

  async create(
    userId: string,
    input: CustomerAddressInput,
  ): Promise<CustomerAddressView> {
    return this.inUserTransaction(userId, async (queryRunner) => {
      const [{ count = 0 } = {}] = (await queryRunner.query(
        `SELECT COUNT(*) AS count FROM customer_addresses
         WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId],
      )) as Array<{ count: string | number }>;
      const isDefault = input.isDefault === true || Number(count) === 0;
      if (isDefault) await this.clearDefault(queryRunner, userId);

      const [row] = (await queryRunner.query(
        `INSERT INTO customer_addresses
           (user_id, recipient_name, phone, email, address, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, recipient_name, phone, email, address, is_default,
                   created_at, updated_at`,
        [
          userId,
          input.recipientName,
          input.phone,
          input.email ?? null,
          input.address,
          isDefault,
        ],
      )) as RawCustomerAddress[];
      if (!row) throw new Error('Không thể lưu địa chỉ khách hàng');
      return this.map(row);
    });
  }

  async saveDefault(
    userId: string,
    input: CustomerAddressInput,
  ): Promise<CustomerAddressView> {
    return this.inUserTransaction(userId, async (queryRunner) => {
      const [current] = (await queryRunner.query(
        `SELECT id FROM customer_addresses
         WHERE user_id = $1 AND is_default = TRUE AND deleted_at IS NULL
         FOR UPDATE`,
        [userId],
      )) as Array<{ id: string }>;

      if (current) {
        const result: unknown = await queryRunner.query(
          `UPDATE customer_addresses
           SET recipient_name = $2, phone = $3,
               email = COALESCE($4, email), address = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING id, user_id, recipient_name, phone, email, address, is_default,
                     created_at, updated_at`,
          [
            current.id,
            input.recipientName,
            input.phone,
            input.email ?? null,
            input.address,
          ],
        );
        const [row] = extractPostgresRows<RawCustomerAddress>(result);
        if (!row) throw new Error('Không thể cập nhật địa chỉ mặc định');
        return this.map(row);
      }

      await this.clearDefault(queryRunner, userId);
      const [row] = (await queryRunner.query(
        `INSERT INTO customer_addresses
           (user_id, recipient_name, phone, email, address, is_default)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id, user_id, recipient_name, phone, email, address, is_default,
                   created_at, updated_at`,
        [
          userId,
          input.recipientName,
          input.phone,
          input.email ?? null,
          input.address,
        ],
      )) as RawCustomerAddress[];
      if (!row) throw new Error('Không thể lưu địa chỉ mặc định');
      return this.map(row);
    });
  }

  async update(
    id: string,
    userId: string,
    input: Partial<CustomerAddressInput>,
  ): Promise<CustomerAddressView | null> {
    return this.inUserTransaction(userId, async (queryRunner) => {
      const [existing] = (await queryRunner.query(
        `SELECT id FROM customer_addresses
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         FOR UPDATE`,
        [id, userId],
      )) as Array<{ id: string }>;
      if (!existing) return null;

      if (input.isDefault === true)
        await this.clearDefault(queryRunner, userId);
      const result: unknown = await queryRunner.query(
        `UPDATE customer_addresses
         SET recipient_name = COALESCE($3, recipient_name),
             phone = COALESCE($4, phone),
             email = COALESCE($5, email),
             address = COALESCE($6, address),
             is_default = CASE WHEN $7::boolean IS NULL THEN is_default ELSE $7 END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         RETURNING id, user_id, recipient_name, phone, email, address, is_default,
                   created_at, updated_at`,
        [
          id,
          userId,
          input.recipientName ?? null,
          input.phone ?? null,
          input.email ?? null,
          input.address ?? null,
          input.isDefault ?? null,
        ],
      );
      const [row] = extractPostgresRows<RawCustomerAddress>(result);
      return row ? this.map(row) : null;
    });
  }

  async remove(id: string, userId: string): Promise<boolean> {
    return this.inUserTransaction(userId, async (queryRunner) => {
      const result: unknown = await queryRunner.query(
        `UPDATE customer_addresses
         SET deleted_at = CURRENT_TIMESTAMP, is_default = FALSE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         RETURNING id, is_default`,
        [id, userId],
      );
      const [removed] = extractPostgresRows<{ id: string }>(result);
      if (!removed) return false;

      await queryRunner.query(
        `UPDATE customer_addresses
         SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = (
           SELECT id FROM customer_addresses
           WHERE user_id = $1 AND deleted_at IS NULL
           ORDER BY updated_at DESC LIMIT 1
         )
         AND NOT EXISTS (
           SELECT 1 FROM customer_addresses
           WHERE user_id = $1 AND is_default = TRUE AND deleted_at IS NULL
         )`,
        [userId],
      );
      return true;
    });
  }

  private async inUserTransaction<T>(
    userId: string,
    work: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await setDatabaseAuditContext(queryRunner, { actorId: userId });
      await queryRunner.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [userId],
      );
      const result = await work(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private clearDefault(
    queryRunner: QueryRunner,
    userId: string,
  ): Promise<unknown> {
    return queryRunner.query(
      `UPDATE customer_addresses
       SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_default = TRUE AND deleted_at IS NULL`,
      [userId],
    );
  }

  private readonly selectSql = `SELECT id, user_id, recipient_name, phone, email,
                                        address, is_default, created_at, updated_at
                                 FROM customer_addresses`;

  private map(row: RawCustomerAddress): CustomerAddressView {
    return {
      id: row.id,
      userId: row.user_id,
      recipientName: row.recipient_name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
