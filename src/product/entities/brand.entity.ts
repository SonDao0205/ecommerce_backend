import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { Product } from './product.entity.js';

@Entity({ name: 'brands' })
@Unique('uq_brands_name', ['name'])
@Unique('uq_brands_slug', ['slug'])
export class Brand {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 120, nullable: false })
  name: string;

  @Column({ name: 'slug', type: 'varchar', length: 150, nullable: false })
  slug: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logo_url: string | null;

  @Column({ name: 'is_active', type: 'smallint', default: 1 })
  is_active: number;

  @OneToMany(() => Product, (product) => product.brand)
  products: Relation<Product[]>;
}
