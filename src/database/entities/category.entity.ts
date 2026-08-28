import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Category Entity: Danh mục sản phẩm.
 * - Hỗ trợ cấu trúc phân cấp cây danh mục cha - con (Self-referencing).
 */
@Entity('categories')
export class Category extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name?: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 180, unique: true })
  slug?: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive?: boolean;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => Category, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: Category;

  /** Giá trị runtime được repository map từ subquery, không phải column. */
  childCount?: number;
}
