import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Address } from '../../user/entities/address.entity.js';
import { User } from '../../user/entities/user.entity.js';
import { PaymentMethod } from '../../payment/entities/payment-method.entity.js';
import { ShopOrder } from '../../shop/entities/shop_order.entity.js';
import { OrderPaymentStatus, OrderStatus } from './enum/order.enum.js';

@Entity({ name: 'orders' })
@Unique('uq_orders_order_number', ['order_number'])
@Index('idx_orders_user_created', ['user_id', 'created_at'])
@Index('idx_orders_address', ['address_id'])
@Index('uq_orders_user_idempotency_key', ['user_id', 'idempotency_key'], {
  unique: true,
})
@Check(
  'chk_orders_status',
  `"status" IN ('${OrderStatus.PENDING}', '${OrderStatus.CONFIRMED}', '${OrderStatus.COMPLETED}', '${OrderStatus.CANCELLED}', '${OrderStatus.REFUNDED}')`,
)
@Check(
  'chk_orders_payment_status',
  `"payment_status" IN ('${OrderPaymentStatus.PENDING}', '${OrderPaymentStatus.PAID}', '${OrderPaymentStatus.FAILED}', '${OrderPaymentStatus.REFUNDED}')`,
)
@Check(
  'chk_orders_amounts',
  '"subtotal" >= 0 AND "discount_amount" >= 0 AND "shipping_fee" >= 0 AND "total_amount" >= 0',
)
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({
    name: 'order_number',
    type: 'varchar',
    length: 40,
    nullable: false,
  })
  order_number: string;

  @Column({ name: 'user_id', type: 'bigint', nullable: false })
  user_id: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  idempotency_key: string | null;

  @Column({
    name: 'request_hash',
    type: 'char',
    length: 64,
    nullable: true,
  })
  request_hash: string | null;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_orders_user' })
  user: Relation<User>;

  @Column({ name: 'address_id', type: 'bigint', nullable: false })
  address_id: string;

  @ManyToOne(() => Address, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'address_id',
    foreignKeyConstraintName: 'fk_orders_address',
  })
  address: Relation<Address>;

  @Column({ name: 'payment_method_id', type: 'bigint', nullable: true })
  payment_method_id: string | null;

  @ManyToOne(() => PaymentMethod, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'payment_method_id',
    foreignKeyConstraintName: 'fk_orders_payment_method',
  })
  payment_method: Relation<PaymentMethod> | null;

  @Column({
    name: 'subtotal',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  subtotal: string;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
    default: 0,
  })
  discount_amount: string;

  @Column({
    name: 'shipping_fee',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
    default: 0,
  })
  shipping_fee: string;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  total_amount: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    nullable: false,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    name: 'payment_status',
    type: 'varchar',
    length: 20,
    nullable: false,
    default: OrderPaymentStatus.PENDING,
  })
  payment_status: OrderPaymentStatus;

  @Column({
    name: 'customer_note',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  customer_note: string | null;

  @OneToMany(() => ShopOrder, (shopOrder) => shopOrder.order)
  shop_orders: Relation<ShopOrder[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;
}
