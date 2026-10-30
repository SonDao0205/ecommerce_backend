import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'shipping_methods' })
@Unique('uq_shipping_methods_code', ['code'])
export class ShippingMethod {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'code', type: 'varchar', length: 30, nullable: false })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({
    name: 'base_fee',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: false,
    default: 0,
  })
  base_fee: string;

  @Column({
    name: 'estimated_days',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  estimated_days: string | null;

  @Column({
    name: 'is_active',
    type: 'smallint',
    nullable: false,
    default: 1,
  })
  is_active: number;
}
