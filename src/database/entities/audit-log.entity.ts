import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/**
 * AuditLog Entity: Ghi vết kiểm toán các thao tác quan trọng trong hệ thống.
 * - Lưu vết trước và sau khi thay đổi dữ liệu (old_value và new_value).
 * - Phục vụ truy vết an ninh, đối soát và điều tra lỗi.
 */
@Entity('audit_logs')
export class AuditLog extends BaseEntity {
  // Tên hành động (ví dụ: 'PRODUCT_UPDATE', 'INVENTORY_ADJUST', 'ORDER_STATUS_UPDATE')
  @Index()
  @Column({ type: 'varchar', length: 100 })
  action?: string;

  // Tên thực thể / bảng bị tác động (ví dụ: 'Product', 'Inventory', 'Order')
  @Index()
  @Column({ name: 'entity_name', type: 'varchar', length: 100 })
  entityName?: string;

  // ID của bản ghi cụ thể bị tác động
  @Index()
  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId?: string;

  // Người thực hiện thao tác (Admin / Staff / Khách hàng)
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: User;

  // Trạng thái dữ liệu cũ trước khi thay đổi (dạng JSON)
  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue?: Record<string, any>;

  // Trạng thái dữ liệu mới sau khi thay đổi (dạng JSON)
  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue?: Record<string, any>;

  // Địa chỉ IP của client thực hiện request
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  // Trình duyệt / Client User-Agent
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;
}
