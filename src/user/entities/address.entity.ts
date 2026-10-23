import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from './user.entity.js';

@Entity({ name: 'addresses' })
export class Address {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @ManyToOne(() => User, (user) => user.addresses, {
    nullable: false,
  })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({
    name: 'recipient_name',
    type: 'varchar',
    length: 120,
    nullable: false,
  })
  recipient_name: string;

  @Column({
    name: 'phone',
    type: 'varchar',
    length: 20,
    nullable: false,
  })
  phone: string;

  @Column({
    name: 'province',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  province: string;

  @Column({
    name: 'district',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  district: string;

  @Column({
    name: 'ward',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  ward: string;

  @Column({
    name: 'street_detail',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  street_detail: string;

  @Column({
    name: 'is_default',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  is_default: boolean;

  @CreateDateColumn({
    name: `created_at`,
    type: `timestamp`,
  })
  created_at: Date;

  @UpdateDateColumn({
    name: `updated_at`,
    type: `timestamp`,
  })
  updated_at: Date;
}
