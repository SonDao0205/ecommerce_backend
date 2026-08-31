import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Product } from './product.entity';
import { User } from './user.entity';
import { OrderItem } from './order-item.entity';

export interface ReviewMedia {
  url: string;
  publicId: string;
  resourceType: 'image' | 'video';
}

@Entity('product_reviews')
export class ProductReview extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'order_item_id', type: 'uuid', unique: true })
  orderItemId?: string;

  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem?: OrderItem;

  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId?: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'smallint' }) rating?: number;
  @Column({ type: 'text' }) content?: string;
  @Column({ type: 'jsonb', default: () => "'[]'" }) media?: ReviewMedia[];

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

  @Column({ name: 'admin_reply', type: 'text', nullable: true })
  adminReply?: string | null;
  @Column({ name: 'replied_at', type: 'timestamptz', nullable: true })
  repliedAt?: Date | null;
  @Column({ name: 'replied_by', type: 'uuid', nullable: true })
  repliedBy?: string | null;
}
