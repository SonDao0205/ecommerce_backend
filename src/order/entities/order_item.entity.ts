import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Product } from '../../product/entities/product.entity.js';
import { ProductVariant } from '../../product/entities/product_variant.entity.js';
import { ShopOrder } from '../../shop/entities/shop_order.entity.js';

@Entity({ name: 'order_items' })
@Index('idx_order_items_shop_order', ['shop_order_id'])
@Index('idx_order_items_product', ['product_id'])
@Check('chk_order_items_quantity', '"quantity" > 0')
@Check('chk_order_items_amounts', '"unit_price" >= 0 AND "line_total" >= 0')
export class OrderItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'shop_order_id', type: 'bigint', nullable: false })
  shop_order_id: string;

  @ManyToOne(() => ShopOrder, (shopOrder) => shopOrder.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'shop_order_id',
    foreignKeyConstraintName: 'fk_order_items_shop_order',
  })
  shop_order: Relation<ShopOrder>;

  @Column({ name: 'product_id', type: 'bigint', nullable: true })
  product_id: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_order_items_product',
  })
  product: Relation<Product> | null;

  @Column({ name: 'variant_id', type: 'bigint', nullable: true })
  variant_id: string | null;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'variant_id',
    foreignKeyConstraintName: 'fk_order_items_variant',
  })
  variant: Relation<ProductVariant> | null;

  @Column({
    name: 'product_name',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  product_name: string;

  @Column({
    name: 'variant_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  variant_name: string | null;

  @Column({ name: 'sku', type: 'varchar', length: 80, nullable: true })
  sku: string | null;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  unit_price: string;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  quantity: number;

  @Column({
    name: 'line_total',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
  })
  line_total: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;
}
