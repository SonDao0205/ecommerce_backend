import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum UserRoleEnum {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  WAREHOUSE = 'warehouse',
  STAFF = 'staff',
}

/**
 * Role Entity: Bảng danh mục các quyền hạn (Master Data) trong hệ thống RBAC.
 */
@Entity('roles')
export class Role extends BaseEntity {
  // Tên quyền duy nhất (admin, customer, warehouse, staff)
  @Index({ unique: true })
  @Column({
    type: 'enum',
    enum: UserRoleEnum,
    unique: true,
    default: UserRoleEnum.CUSTOMER,
  })
  name?: UserRoleEnum;

  // Mô tả chi tiết vai trò của quyền hạn
  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;
}
