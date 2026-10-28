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
import { Product } from './product.entity.js';
import { VariantAttributeValue } from './variant_attribute_value.entity.js';
import { ProductVariantStatus } from './enum/product.enum.js';

@Entity({ name: 'product_variants' })
@Unique('uq_variants_sku', ['sku'])
@Index('idx_variants_product', ['product_id'])
@Check('chk_variants_stock', '"stock" >= 0')
@Check('chk_variants_price', '"price" >= 0')
@Check(
  'chk_variants_status',
  `"status" IN ('${ProductVariantStatus.ACTIVE}', '${ProductVariantStatus.INACTIVE}')`,
)
export class ProductVariant {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'product_id', type: 'bigint', nullable: false })
  product_id: string;

  @ManyToOne(() => Product, (product) => product.variants, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  @Column({ name: 'sku', type: 'varchar', length: 80, nullable: false })
  sku: string;

  @Column({ name: 'name', type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ name: 'price', type: 'decimal', precision: 15, scale: 2 })
  price: string;

  @Column({ name: 'stock', type: 'integer', default: 0 })
  stock: number;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  image_url: string | null;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: ProductVariantStatus.ACTIVE,
  })
  status: ProductVariantStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;

  @OneToMany(
    () => VariantAttributeValue,
    (attributeValue) => attributeValue.variant,
  )
  attribute_values: Relation<VariantAttributeValue[]>;
}
