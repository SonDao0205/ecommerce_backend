import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { ProductVariant } from './product_variant.entity.js';
import { AttributeValues } from '../../category/entities/attribute_values.entity.js';

@Entity({ name: 'variant_attribute_values' })
export class VariantAttributeValue {
  @PrimaryColumn({ name: 'variant_id', type: 'bigint' })
  variant_id: string;

  @PrimaryColumn({ name: 'attribute_value_id', type: 'bigint' })
  attribute_value_id: string;

  @ManyToOne(() => ProductVariant, (variant) => variant.attribute_values, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variant_id' })
  variant: Relation<ProductVariant>;

  @ManyToOne(() => AttributeValues, (attributeValue) => attributeValue.variants, {
    nullable: false,
  })
  @JoinColumn({ name: 'attribute_value_id' })
  attribute_value: Relation<AttributeValues>;
}
