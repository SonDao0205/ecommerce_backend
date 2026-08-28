import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Inventory } from './inventory.entity';
import { User } from './user.entity';
import { ProductVariant } from './product-variant.entity';

export enum InventoryTransactionType {
  IMPORT = 'import',
  EXPORT = 'export',
  ADJUSTMENT = 'adjustment',
  ORDER_RESERVE = 'order_reserve',
  ORDER_RESTOCK = 'order_restock',
}

/**
 * InventoryTransaction Entity: Nhật ký ghi lại từng lần biến động số lượng tồn kho.
 * - Hỗ trợ kiểm toán, đối soát và theo dõi dòng hàng trong kho.
 */
@Entity('inventory_transactions')
export class InventoryTransaction extends BaseEntity {
  @Column({ name: 'inventory_id', type: 'uuid' })
  inventoryId?: string;

  @ManyToOne(() => Inventory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  inventory?: Inventory;

  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId?: string | null;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variant_id' })
  variant?: ProductVariant | null;

  // Loại giao dịch kho: Nhập hàng, Xuất hàng, Kiểm kê điều chỉnh, Giữ chỗ đơn...
  @Column({
    type: 'enum',
    enum: InventoryTransactionType,
  })
  type?: InventoryTransactionType;

  // Số lượng thay đổi (dương là tăng kho, âm là giảm kho)
  @Column({ type: 'int' })
  quantity?: number;

  // Tồn kho trước thời điểm giao dịch
  @Column({ name: 'previous_stock', type: 'int' })
  previousStock?: number;

  // Tồn kho sau khi giao dịch thành công
  @Column({ name: 'new_stock', type: 'int' })
  newStock?: number;

  // Lý do thực hiện biến động (ví dụ: 'Nhập lô hàng mới', 'Hàng hư hỏng')
  @Column({ type: 'text', nullable: true })
  reason?: string;

  // Người thực hiện giao dịch (Admin / Thủ kho)
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: User;
}
