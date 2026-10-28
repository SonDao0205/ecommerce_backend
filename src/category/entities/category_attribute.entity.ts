import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Categories } from './categories.entity.js';
import { Attributes } from './attributes.entity.js';

@Entity({ name: 'category_attributes' })
@Index('idx_category_attributes_attribute', ['attribute_id'])
export class CategoryAttribute {
  @PrimaryColumn({ name: 'category_id', type: 'bigint' })
  category_id: string;

  @PrimaryColumn({ name: 'attribute_id', type: 'bigint' })
  attribute_id: string;

  @ManyToOne(() => Categories, (category) => category.default_attributes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: Relation<Categories>;

  @ManyToOne(() => Attributes, (attribute) => attribute.categories, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attribute_id' })
  attribute: Relation<Attributes>;
}
