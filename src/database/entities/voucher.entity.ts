import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum VoucherStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}

export enum VoucherType {
  ORDER_DISCOUNT = 'order_discount',
}

export enum VoucherDiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export enum VoucherScope {
  SHOP = 'shop',
  PRODUCTS = 'products',
  CATEGORIES = 'categories',
}

export enum VoucherAudience {
  ALL = 'all',
  NEW_CUSTOMERS = 'new_customers',
  EXISTING_CUSTOMERS = 'existing_customers',
  MEMBER_GROUPS = 'member_groups',
  SPECIFIC_CUSTOMERS = 'specific_customers',
}

@Entity('vouchers')
export class Voucher extends BaseEntity {
  @Column({ type: 'varchar', length: 150 }) name?: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  code?: string;

  @Column({ type: 'text', nullable: true }) description?: string | null;

  @Column({ type: 'enum', enum: VoucherStatus, default: VoucherStatus.DRAFT })
  status?: VoucherStatus;

  @Column({ name: 'voucher_type', type: 'enum', enum: VoucherType })
  voucherType?: VoucherType;

  @Column({ name: 'discount_type', type: 'enum', enum: VoucherDiscountType })
  discountType?: VoucherDiscountType;

  @Column({ name: 'discount_value', type: 'decimal', precision: 12, scale: 2 })
  discountValue?: number;

  @Column({
    name: 'max_discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  maxDiscountAmount?: number | null;

  @Column({
    name: 'minimum_order_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  minimumOrderAmount?: number;

  @Column({ type: 'enum', enum: VoucherScope, default: VoucherScope.SHOP })
  scope?: VoucherScope;

  @Column({ type: 'enum', enum: VoucherAudience, default: VoucherAudience.ALL })
  audience?: VoucherAudience;

  @Column({ name: 'start_at', type: 'timestamptz' }) startAt?: Date;
  @Column({ name: 'end_at', type: 'timestamptz' }) endAt?: Date;

  @Column({ name: 'issued_quantity', type: 'integer', nullable: true })
  issuedQuantity?: number | null;

  @Column({ name: 'max_usage_count', type: 'integer', nullable: true })
  maxUsageCount?: number | null;

  @Column({ name: 'usage_limit_per_user', type: 'integer', default: 1 })
  usageLimitPerUser?: number;

  @Column({ name: 'used_count', type: 'integer', default: 0 })
  usedCount?: number;

  @Column({ name: 'combinable_with_vouchers', type: 'boolean', default: false })
  combinableWithVouchers?: boolean;

  @Column({
    name: 'combinable_with_flash_sale',
    type: 'boolean',
    default: false,
  })
  combinableWithFlashSale?: boolean;

  @Column({
    name: 'combinable_with_promotions',
    type: 'boolean',
    default: false,
  })
  combinableWithPromotions?: boolean;
}
