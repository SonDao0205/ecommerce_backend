import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Order } from './order.entity';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

/**
 * OrderItem Entity: Bảng chi tiết từng món hàng trong đơn hàng.
 * - Lưu Snapshot giá và tên sản phẩm tại thời điểm mua để giữ nguyên giá trị hóa đơn
 *   kể cả khi sau này bảng Product có thay đổi giá hoặc bị xóa.
 */
@Entity('order_items')
export class OrderItem extends BaseEntity {
  // Khóa ngoại đến đơn hàng
  @Column({ name: 'order_id', type: 'uuid' })
  orderId?: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  // Khóa ngoại đến sản phẩm (nullable: true để khi xóa Product trong hệ thống thì đơn hàng cũ không bị lỗi)
  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId?: string;

  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId?: string | null;

  @ManyToOne(() => ProductVariant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variant_id' })
  variant?: ProductVariant | null;

  // Snapshot: Tên sản phẩm tại thời điểm đặt đơn
  @Column({ name: 'product_name', type: 'varchar', length: 255 })
  productName?: string;

  @Column({
    name: 'variant_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  variantName?: string | null;

  @Column({
    name: 'variant_value',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  variantValue?: string | null;

  @Column({ name: 'variant_sku', type: 'varchar', length: 100, nullable: true })
  variantSku?: string | null;

  // Snapshot: Đơn giá sản phẩm tại thời điểm đặt đơn
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  unitPrice?: number;

  // Số lượng mua
  @Column({ type: 'int' })
  quantity?: number;

  // Thành tiền dòng hàng = unit_price * quantity
  @Column({
    name: 'subtotal',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  subtotal?: number;
}
