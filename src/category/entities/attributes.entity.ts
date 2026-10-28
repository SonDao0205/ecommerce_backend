import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AttributeValues } from './attribute_values.entity.js';
import { CategoryAttribute } from './category_attribute.entity.js';

@Entity({ name: 'attributes' })
export class Attributes {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 80, unique: true })
  name: string;

  @OneToMany(() => AttributeValues, (attributeValue) => attributeValue.attribute)
  values: Relation<AttributeValues[]>;

  @OneToMany(
    () => CategoryAttribute,
    (categoryAttribute) => categoryAttribute.attribute,
  )
  categories: Relation<CategoryAttribute[]>;
}
