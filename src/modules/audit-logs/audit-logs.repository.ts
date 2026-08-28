import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AuditLogView {
  id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entityName: string;
  entityId: string | null;
  description: string;
  actorId: string | null;
  actorName: string;
  actorEmail: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: Date;
}

interface RawAuditLog {
  id: string;
  action: AuditLogView['action'];
  entity_name: string;
  entity_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: Date;
}

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findRecent(limit: number, offset: number): Promise<AuditLogView[]> {
    const rows = await this.dataSource.query<RawAuditLog[]>(
      `SELECT log.id, log.action, log.entity_name, log.entity_id,
              log.actor_id, actor.full_name AS actor_name,
              actor.email AS actor_email, log.old_value, log.new_value,
              log.created_at
       FROM audit_logs log
       LEFT JOIN users actor ON actor.id = log.actor_id
       ORDER BY log.created_at DESC, log.id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityName: row.entity_name,
      entityId: row.entity_id,
      description: this.describe(row),
      actorId: row.actor_id,
      actorName: row.actor_name ?? 'Hệ thống',
      actorEmail: row.actor_email,
      oldValue: row.old_value,
      newValue: row.new_value,
      createdAt: row.created_at,
    }));
  }

  private describe(row: RawAuditLog): string {
    const action = { INSERT: 'Thêm', UPDATE: 'Cập nhật', DELETE: 'Xóa' }[
      row.action
    ];
    const entityLabels: Record<string, string> = {
      products: 'sản phẩm',
      product_variants: 'biến thể',
      categories: 'danh mục',
      inventories: 'tồn kho sản phẩm',
      orders: 'đơn hàng',
      order_items: 'sản phẩm trong đơn hàng',
      carts: 'giỏ hàng',
      cart_items: 'sản phẩm trong giỏ hàng',
      users: 'tài khoản',
      user_roles: 'quyền tài khoản',
      roles: 'vai trò',
      payments: 'thanh toán',
      customer_addresses: 'địa chỉ khách hàng',
    };
    const value = row.new_value ?? row.old_value ?? {};
    const label = entityLabels[row.entity_name] ?? row.entity_name;
    const name = this.readName(row.entity_name, value);
    return `${action} ${label}${name ? ` “${name}”` : ''}`;
  }

  private readName(
    entityName: string,
    value: Record<string, unknown>,
  ): string | null {
    const candidates =
      entityName === 'orders'
        ? ['order_code']
        : entityName === 'customer_addresses'
          ? ['recipient_name']
          : entityName === 'users'
            ? ['full_name', 'email']
            : entityName === 'product_variants'
              ? ['value', 'sku']
              : ['name', 'product_name', 'sku'];
    for (const key of candidates) {
      if (typeof value[key] === 'string' && value[key]) return value[key];
    }
    return null;
  }
}
