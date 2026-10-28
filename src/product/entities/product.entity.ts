import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Shop } from '../../shop/entities/shop.entity.js';
import { Categories } from '../../category/entities/categories.entity.js';
import { Brand } from './brand.entity.js';
import { ProductImage } from './product_image.entity.js';
import { ProductVariant } from './product_variant.entity.js';
import { ProductStatus } from './enum/product.enum.js';

@Entity({ name: 'products' })
@Unique('uq_products_slug', ['slug'])
@Index('idx_products_shop', ['shop_id'])
@Index('idx_products_category', ['category_id', 'status', 'is_deleted'])
@Index('idx_products_brand', ['brand_id'])
@Index('idx_products_price', ['price'])
@Index('idx_products_sold', ['sold_count'])
@Check(
  'chk_products_status',
  `"status" IN ('${ProductStatus.DRAFT}', '${ProductStatus.PENDING}', '${ProductStatus.ACTIVE}', '${ProductStatus.HIDDEN}', '${ProductStatus.REJECTED}')`,
)
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'shop_id', type: 'bigint', nullable: false })
  shop_id: string;

  @ManyToOne(() => Shop, { nullable: false })
  @JoinColumn({ name: 'shop_id' })
  shop: Relation<Shop>;

  @Column({ name: 'category_id', type: 'bigint', nullable: false })
  category_id: string;

  @ManyToOne(() => Categories, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category: Relation<Categories>;

  @Column({ name: 'brand_id', type: 'bigint', nullable: true })
  brand_id: string | null;

  @ManyToOne(() => Brand, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: Relation<Brand> | null;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ name: 'slug', type: 'varchar', length: 300, nullable: false })
  slug: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 500, nullable: true })
  thumbnail_url: string | null;

  @Column({ name: 'price', type: 'decimal', precision: 15, scale: 2, default: 0 })
  price: string;

  @Column({ name: 'sold_count', type: 'integer', default: 0 })
  sold_count: number;

  @Column({ name: 'rating_avg', type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating_avg: string;

  @Column({ name: 'rating_count', type: 'integer', default: 0 })
  rating_count: number;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: ProductStatus.PENDING,
  })
  status: ProductStatus;

  @Column({ name: 'reject_reason', type: 'varchar', length: 500, nullable: true })
  reject_reason: string | null;

  @Column({ name: 'is_deleted', type: 'smallint', default: 0 })
  is_deleted: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => ProductImage, (image) => image.product)
  images: Relation<ProductImage[]>;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: Relation<ProductVariant[]>;
}
