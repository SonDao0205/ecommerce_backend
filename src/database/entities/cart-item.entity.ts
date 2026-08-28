import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Cart } from './cart.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

/**
 * CartItem Entity: Bảng trung gian chi tiết các mặt hàng nằm trong giỏ hàng.
 * - Nối Cart ⟷ Product kèm theo số lượng quantity.
 */
@Entity('cart_items')
@Index('UQ_cart_item_without_variant', ['cartId', 'productId'], {
  unique: true,
  where: '"variant_id" IS NULL',
})
@Index('UQ_cart_item_with_variant', ['cartId', 'productId', 'variantId'], {
  unique: true,
  where: '"variant_id" IS NOT NULL',
})
export class CartItem extends BaseEntity {
  // Khóa ngoại đến giỏ hàng
  @Column({ name: 'cart_id', type: 'uuid' })
  cartId?: string;

  @ManyToOne(() => Cart, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart?: Cart;

  // Khóa ngoại đến sản phẩm
  @Column({ name: 'product_id', type: 'uuid' })
  productId?: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId?: string | null;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant?: ProductVariant | null;

  // Số lượng sản phẩm muốn mua (bắt buộc > 0)
  @Column({ type: 'int', default: 1 })
  quantity?: number;
}
