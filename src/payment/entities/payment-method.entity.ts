import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'payment_methods' })
@Unique('uq_payment_methods_code', ['code'])
export class PaymentMethod {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'code', type: 'varchar', length: 30, nullable: false })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ name: 'is_active', type: 'smallint', nullable: false, default: 1 })
  is_active: number;

  @Column({ name: 'sort_order', type: 'integer', nullable: false, default: 0 })
  sort_order: number;
}
