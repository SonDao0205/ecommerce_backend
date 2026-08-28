import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Product } from './product.entity';

/**
 * Inventory Entity: Quản lý số lượng hàng tồn kho cho từng sản phẩm.
 */
@Entity('inventories')
export class Inventory extends BaseEntity {
  // Mỗi sản phẩm có 1 bản ghi tồn kho duy nhất
  @Index({ unique: true })
  @Column({ name: 'product_id', type: 'uuid', unique: true })
  productId?: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  // Số lượng thực tế có sẵn để khách đặt mua
  @Column({ type: 'int', default: 0 })
  stock?: number;

  // Số lượng đang được giữ chỗ (khách vừa đặt đơn, đang chờ thanh toán hoặc đang đóng gói)
  @Column({ name: 'reserved_stock', type: 'int', default: 0 })
  reservedStock?: number;

  // Ngưỡng cảnh báo sắp hết hàng để thông báo nhập thêm
  @Column({ name: 'low_stock_threshold', type: 'int', default: 10 })
  lowStockThreshold?: number;
}
