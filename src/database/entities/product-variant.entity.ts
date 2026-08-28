import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => ProductVariant, (variant) => variant.children, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: ProductVariant;

  @OneToMany(() => ProductVariant, (variant) => variant.parent)
  children?: ProductVariant[];

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 150 })
  value!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  sku?: string | null;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  unitPrice?: number | null;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
