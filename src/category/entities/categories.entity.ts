import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { CategoryAttribute } from './category_attribute.entity.js';

@Entity({ name: 'categories' })
@Index('idx_categories_parent', ['parent_id'])
@Index('idx_categories_search_gin', { synchronize: false })
export class Categories {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parent_id: string | null;

  @ManyToOne(() => Categories, (category) => category.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Relation<Categories> | null;

  @OneToMany(() => Categories, (category) => category.parent)
  children: Relation<Categories[]>;

  @OneToMany(
    () => CategoryAttribute,
    (categoryAttribute) => categoryAttribute.category,
  )
  default_attributes: Relation<CategoryAttribute[]>;

  @Column({ name: 'name', type: 'varchar', length: 120, nullable: false })
  name: string;

  @Column({ name: 'slug', type: 'varchar', length: 150, unique: true })
  slug: string;

  @Column({
    name: 'image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  image_url: string | null;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sort_order: number;

  @Column({ name: 'is_active', type: 'smallint', default: 1 })
  is_active: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updated_at: Date;
}
