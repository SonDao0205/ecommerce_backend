import {
  Column,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Category } from './category.entity';
import { ProductVariant } from './product-variant.entity';

/**
 * Product Entity: Thông tin sản phẩm được bày bán trên hệ thống E-Commerce.
 */
@Entity('products')
export class Product extends BaseEntity {
  // Tên sản phẩm
  @Column({ type: 'varchar', length: 255 })
  name?: string;

  // Đường dẫn SEO duy nhất (ví dụ: iphone-15-pro-max-256gb)
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  slug?: string;

  // Mô tả chi tiết sản phẩm (hỗ trợ văn bản/HTML)
  @Column({ type: 'text', nullable: true })
  description?: string;

  // Mã quản lý kho hàng SKU (Stock Keeping Unit) duy nhất
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  sku?: string;

  // Giá bán hiện tại của sản phẩm
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  unitPrice?: number;

  // Giá niêm yết ban đầu trước khi giảm giá (để tính % giảm giá trên UI)
  @Column({
    name: 'original_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  originalPrice?: number;

  // Ảnh đại diện sản phẩm (thumbnail hiển thị ở danh sách)
  @Column({ name: 'thumbnail_url', type: 'text', nullable: true })
  thumbnailUrl?: string;

  // Danh sách ảnh phụ chi tiết dưới định dạng JSON array
  @Column({
    name: 'images',
    type: 'jsonb',
    nullable: true,
    default: () => "'[]'",
  })
  images?: string[];

  // Trạng thái sản phẩm (true: đang bán, false: ngừng kinh doanh)
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive?: boolean;

  // Khóa ngoại đến danh mục sản phẩm
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string;

  @ManyToOne(() => Category, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants?: ProductVariant[];

  /** Tổng tồn kho khả dụng do repository tính, không phải column. */
  availableStock?: number;

  /** Tồn kho tổng trong bảng inventories, không phải column của products. */
  stock?: number;
}
