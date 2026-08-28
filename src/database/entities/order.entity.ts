import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPING = 'shipping',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

/**
 * Order Entity: Đơn hàng do khách hàng đặt mua.
 */
@Entity('orders')
@Index('UQ_orders_user_idempotency_key', ['userId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
export class Order extends BaseEntity {
  // Mã đơn hàng hiển thị với khách hàng (ví dụ: ORD-20260826-XXXX)
  @Index({ unique: true })
  @Column({ name: 'order_code', type: 'varchar', length: 50, unique: true })
  orderCode?: string;

  // ID của khách hàng đặt đơn
  @Column({ name: 'user_id', type: 'uuid' })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  idempotencyKey?: string | null;

  @Column({
    name: 'request_fingerprint',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  requestFingerprint?: string | null;

  // Trạng thái vòng đời đơn hàng: Chờ xác nhận -> Đã xác nhận -> Đang xử lý -> Đang giao -> Hoàn tất / Đã hủy
  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status?: OrderStatus;

  // Tổng tiền phải thanh toán của đơn hàng (do Backend tự tính toán)
  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalAmount?: number;

  // Địa chỉ nhận hàng chi tiết
  @Column({ name: 'shipping_address', type: 'text' })
  shippingAddress?: string;

  // Tên người nhận hàng
  @Column({ name: 'recipient_name', type: 'varchar', length: 150 })
  recipientName?: string;

  // Số điện thoại người nhận hàng
  @Column({ name: 'recipient_phone', type: 'varchar', length: 20 })
  recipientPhone?: string;

  // Ghi chú của khách hàng khi đặt hàng
  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt?: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items?: OrderItem[];
}
