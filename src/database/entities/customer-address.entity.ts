import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('customer_addresses')
@Index('UQ_customer_addresses_default_user', ['userId'], {
  unique: true,
  where: '"is_default" = TRUE AND "deleted_at" IS NULL',
})
export class CustomerAddress extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'recipient_name', type: 'varchar', length: 150 })
  recipientName?: string;

  @Column({ type: 'varchar', length: 20 })
  phone?: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email?: string | null;

  @Column({ type: 'text' })
  address?: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault?: boolean;
}
