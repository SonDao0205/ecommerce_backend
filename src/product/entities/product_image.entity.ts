import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Product } from './product.entity.js';

@Entity({ name: 'product_images' })
@Index('idx_product_images_product', ['product_id'])
export class ProductImage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'product_id', type: 'bigint', nullable: false })
  product_id: string;

  @ManyToOne(() => Product, (product) => product.images, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  @Column({ name: 'url', type: 'varchar', length: 500, nullable: false })
  url: string;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sort_order: number;

  @Column({ name: 'is_primary', type: 'smallint', default: 0 })
  is_primary: number;
}
