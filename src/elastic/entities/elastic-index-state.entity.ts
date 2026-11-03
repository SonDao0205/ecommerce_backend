import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'elastic_index_states' })
export class ElasticIndexState {
  @PrimaryColumn({ name: 'alias', type: 'varchar', length: 100 })
  alias: string;

  @Column({
    name: 'backfill_completed',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  backfill_completed: boolean;

  @Column({ name: 'backfill_locked_at', type: 'timestamp', nullable: true })
  backfill_locked_at: Date | null;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
