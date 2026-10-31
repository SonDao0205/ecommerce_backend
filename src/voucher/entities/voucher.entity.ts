import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Shop } from '../../shop/entities/shop.entity.js';
import { VoucherDiscountType, VoucherScope } from './enum/voucher.enum.js';

@Entity({ name: 'vouchers' })
@Unique('uq_vouchers_code', ['code'])
@Index('idx_vouchers_shop', ['shop_id'])
@Index('idx_vouchers_period', ['is_active', 'start_at', 'end_at'])
@Check(
  'chk_vouchers_scope',
  `"scope" IN ('${VoucherScope.PLATFORM}', '${VoucherScope.SHOP}')`,
)
@Check(
  'chk_vouchers_scope_shop',
  `("scope" = '${VoucherScope.SHOP}' AND "shop_id" IS NOT NULL) OR ("scope" = '${VoucherScope.PLATFORM}' AND "shop_id" IS NULL)`,
)
@Check(
  'chk_vouchers_type',
  `"discount_type" IN ('${VoucherDiscountType.PERCENT}', '${VoucherDiscountType.FIXED}')`,
)
@Check('chk_vouchers_value', '"discount_value" > 0')
@Check('chk_vouchers_period', '"end_at" > "start_at"')
export class Voucher {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'code', type: 'varchar', length: 50, nullable: false })
  code: string;

  @Column({
    name: 'scope',
    type: 'varchar',
    length: 10,
    nullable: false,
    comment: 'PLATFORM: của sàn | SHOP: của shop',
  })
  scope: VoucherScope;

  @Column({
    name: 'shop_id',
    type: 'bigint',
    nullable: true,
    comment: 'NULL nếu voucher của sàn',
  })
  shop_id: string | null;

  @ManyToOne(() => Shop, { nullable: true })
  @JoinColumn({
    name: 'shop_id',
    foreignKeyConstraintName: 'fk_vouchers_shop',
  })
  shop: Relation<Shop> | null;

  @Column({ name: 'title', type: 'varchar', length: 200, nullable: false })
  title: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({
    name: 'discount_type',
    type: 'varchar',
    length: 10,
    nullable: false,
  })
  discount_type: VoucherDiscountType;

  @Column({
    name: 'discount_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  discount_value: string;

  @Column({
    name: 'max_discount_amount',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    comment: 'Giới hạn giảm khi discount_type = PERCENT',
  })
  max_discount_amount: string | null;

  @Column({
    name: 'min_order_value',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
    default: 0,
  })
  min_order_value: string;

  @Column({
    name: 'usage_limit',
    type: 'integer',
    nullable: true,
    comment: 'Tổng lượt dùng; NULL = không giới hạn',
  })
  usage_limit: number | null;

  @Column({
    name: 'usage_per_user',
    type: 'integer',
    nullable: false,
    default: 1,
  })
  usage_per_user: number;

  @Column({ name: 'used_count', type: 'integer', nullable: false, default: 0 })
  used_count: number;

  @Column({ name: 'start_at', type: 'timestamp', nullable: false })
  start_at: Date;

  @Column({ name: 'end_at', type: 'timestamp', nullable: false })
  end_at: Date;

  @Column({ name: 'is_active', type: 'smallint', nullable: false, default: 1 })
  is_active: number;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  created_by: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
