import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'product_search_outbox' })
@Index('idx_product_search_outbox_due', [
  'processed_at',
  'next_attempt_at',
  'id',
])
@Index('idx_product_search_outbox_product', ['product_id'])
export class ProductSearchOutbox {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'product_id', type: 'bigint', nullable: false })
  product_id: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processed_at: Date | null;

  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  locked_at: Date | null;

  @Column({
    name: 'next_attempt_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  next_attempt_at: Date;

  @Column({ name: 'attempts', type: 'integer', nullable: false, default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'varchar', length: 2000, nullable: true })
  last_error: string | null;
}
