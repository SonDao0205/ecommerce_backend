import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentProvider {
  MOCK = 'mock',
  STRIPE = 'stripe',
  VNPAY = 'vnpay',
  COD = 'cod',
}

/**
 * Payment Entity: Giao dịch thanh toán liên kết với đơn hàng.
 * - Hỗ trợ Idempotency Key để ngăn chặn tình trạng khách bấm nút 2 lần bị trừ tiền 2 lần.
 */
@Entity('payments')
export class Payment extends BaseEntity {
  // Khóa ngoại đến đơn hàng cần thanh toán
  @Column({ name: 'order_id', type: 'uuid' })
  orderId?: string;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  // Số tiền thực hiện thanh toán
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  amount?: number;

  // Trạng thái giao dịch: Chờ xử lý, Thành công, Thất bại, Đã hoàn tiền
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status?: PaymentStatus;

  // Cổng / Phương thức thanh toán: VNPAY, STRIPE, COD, MOCK
  @Column({
    type: 'enum',
    enum: PaymentProvider,
    default: PaymentProvider.MOCK,
  })
  provider?: PaymentProvider;

  // Khóa chống trùng lặp thanh toán (Idempotency Key từ Header gửi lên)
  @Index({ unique: true })
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  idempotencyKey?: string;

  // Mã giao dịch từ cổng thanh toán bên thứ 3 (VNPAY Transaction No, Stripe Charge ID...)
  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  transactionId?: string;

  // Dữ liệu thô (webhook payload) trả về từ cổng thanh toán để đối soát
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
