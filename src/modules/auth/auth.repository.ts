import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role, User, UserRoleEnum } from '@entities';

interface CreateUserData {
  email?: string;
  password: string;
  phone: string;
  fullName: string;
}

interface ExistsRow {
  exists: boolean;
}

interface RawRoleRow {
  id: string;
  name: UserRoleEnum;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RawUserRow {
  id: string;
  email: string | null;
  password?: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  refresh_token?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface RoleNameRow {
  name: UserRoleEnum;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly dataSource: DataSource) {}

  async emailExists(email: string): Promise<boolean> {
    const [row] = await this.dataSource.query<ExistsRow[]>(
      `SELECT EXISTS(
        SELECT 1 FROM users
        WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
      ) AS "exists"`,
      [email],
    );
    return row?.exists ?? false;
  }

  async phoneExists(phone: string): Promise<boolean> {
    const [row] = await this.dataSource.query<ExistsRow[]>(
      `SELECT EXISTS(
        SELECT 1 FROM users
        WHERE phone = $1 AND deleted_at IS NULL
      ) AS "exists"`,
      [phone],
    );
    return row?.exists ?? false;
  }

  async findRoleByName(name: UserRoleEnum): Promise<Role | null> {
    const [row] = await this.dataSource.query<RawRoleRow[]>(
      `SELECT id, name, description, created_at, updated_at, deleted_at
       FROM roles
       WHERE name = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [name],
    );
    return row ? this.mapRole(row) : null;
  }

  async createUserWithRole(data: CreateUserData, role: Role): Promise<User> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const userRows = (await queryRunner.query(
        `INSERT INTO users (email, password, phone, full_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, password, full_name, phone, is_active, avatar_url,
                   refresh_token, created_at, updated_at, deleted_at`,
        [data.email ?? null, data.password, data.phone, data.fullName],
      )) as unknown as RawUserRow[];
      const userRow = userRows[0];
      if (!userRow) throw new Error('Không thể tạo người dùng');

      await queryRunner.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)`,
        [userRow.id, role.id],
      );
      await queryRunner.commitTransaction();
      return this.mapUser(userRow);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.findByIdentifierWithPassword(email);
  }

  async findByIdentifierWithPassword(identifier: string): Promise<User | null> {
    const [row] = await this.dataSource.query<RawUserRow[]>(
      `SELECT id, email, password, full_name, phone, is_active, avatar_url,
              refresh_token, created_at, updated_at, deleted_at
       FROM users
       WHERE (LOWER(email) = LOWER($1) OR phone = $1)
         AND deleted_at IS NULL
       LIMIT 1`,
      [identifier],
    );
    return row ? this.mapUser(row) : null;
  }

  async findByIdWithRefreshToken(id: string): Promise<User | null> {
    const [row] = await this.dataSource.query<RawUserRow[]>(
      `SELECT id, email, full_name, phone, is_active, avatar_url,
              refresh_token, created_at, updated_at, deleted_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return row ? this.mapUser(row) : null;
  }

  async findRoleNamesByUserId(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query<RoleNameRow[]>(
      `SELECT r.name
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
       WHERE ur.user_id = $1 AND ur.deleted_at IS NULL
       ORDER BY r.name ASC`,
      [userId],
    );
    return rows.map((row) => row.name);
  }

  async updateRefreshToken(
    userId: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE users
       SET refresh_token = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId, hashedRefreshToken],
    );
  }

  private mapRole(row: RawRoleRow): Role {
    return Object.assign(new Role(), {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }

  private mapUser(row: RawUserRow): User {
    return Object.assign(new User(), {
      id: row.id,
      email: row.email,
      password: row.password,
      fullName: row.full_name ?? undefined,
      phone: row.phone ?? undefined,
      isActive: row.is_active,
      avatarUrl: row.avatar_url ?? undefined,
      refreshToken: row.refresh_token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    });
  }
}
