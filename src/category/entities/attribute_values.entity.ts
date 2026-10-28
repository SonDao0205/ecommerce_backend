import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Attributes } from './attributes.entity.js';

@Entity({ name: 'attribute_values' })
@Unique('uq_attribute_values', ['attribute_id', 'value'])
export class AttributeValues {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'attribute_id', type: 'bigint', nullable: false })
  attribute_id: string;

  @ManyToOne(() => Attributes, (attribute) => attribute.values, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attribute_id' })
  attribute: Relation<Attributes>;

  @Column({ name: 'value', type: 'varchar', length: 100, nullable: false })
  value: string;
}
