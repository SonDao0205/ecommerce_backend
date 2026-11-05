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
import { Order } from '../../order/entities/order.entity.js';
import { OrderItem } from '../../order/entities/order_item.entity.js';
import { ShippingMethod } from '../../shipping/entities/shipping.entity.js';
import { ShopOrderStatus } from './enum/shop-order.enum.js';
import { Shop } from './shop.entity.js';

@Entity({ name: 'shop_orders' })
@Unique('uq_shop_orders_order_shop', ['order_id', 'shop_id'])
@Index('idx_shop_orders_shop_created', ['shop_id', 'created_at'])
@Index('idx_shop_orders_order', ['order_id'])
@Check(
  'chk_shop_orders_status',
  `"status" IN ('${ShopOrderStatus.PENDING}', '${ShopOrderStatus.CONFIRMED}', '${ShopOrderStatus.PROCESSING}', '${ShopOrderStatus.SHIPPED}', '${ShopOrderStatus.DELIVERED}', '${ShopOrderStatus.CANCELLED}', '${ShopOrderStatus.RETURNED}')`,
)
@Check(
  'chk_shop_orders_amounts',
  '"subtotal" >= 0 AND "discount_amount" >= 0 AND "shipping_fee" >= 0 AND "total_amount" >= 0',
)
export class ShopOrder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'order_id', type: 'bigint', nullable: false })
  order_id: string;

  @ManyToOne(() => Order, (order) => order.shop_orders, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: 'fk_shop_orders_order',
  })
  order: Relation<Order>;

  @Column({ name: 'shop_id', type: 'bigint', nullable: false })
  shop_id: string;

  @ManyToOne(() => Shop, (shop) => shop.shop_orders, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'shop_id',
    foreignKeyConstraintName: 'fk_shop_orders_shop',
  })
  shop: Relation<Shop>;

  @Column({ name: 'shipping_method_id', type: 'bigint', nullable: true })
  shipping_method_id: string | null;

  @ManyToOne(() => ShippingMethod, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'shipping_method_id',
    foreignKeyConstraintName: 'fk_shop_orders_shipping_method',
  })
  shipping_method: Relation<ShippingMethod> | null;

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
    default: ShopOrderStatus.PENDING,
  })
  status: ShopOrderStatus;

  @Column({
    name: 'tracking_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tracking_number: string | null;

  @OneToMany(() => OrderItem, (item) => item.shop_order)
  items: Relation<OrderItem[]>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;
}
