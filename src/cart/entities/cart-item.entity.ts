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
import { ProductVariant } from '../../product/entities/product_variant.entity.js';
import { Cart } from './cart.entity.js';

@Entity({ name: 'cart_items' })
@Unique('uq_cart_items', ['cart_id', 'variant_id'])
@Index('idx_cart_items_variant', ['variant_id'])
@Check('chk_cart_items_qty', '"quantity" > 0')
export class CartItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'cart_id', type: 'bigint', nullable: false })
  cart_id: string;

  @ManyToOne(() => Cart, (cart) => cart.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cart_id' })
  cart: Relation<Cart>;

  @Column({ name: 'variant_id', type: 'bigint', nullable: false })
  variant_id: string;

  @ManyToOne(() => ProductVariant, (variant) => variant.cart_items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: Relation<ProductVariant>;

  @Column({ name: 'quantity', type: 'integer', nullable: false, default: 1 })
  quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;
}
