import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../user/entities/user.entity.js';
import { ShopStatus } from './enum/shop.enum.js';

@Entity({ name: 'shop' })
export class Shop {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @OneToOne(() => User, (user) => user.shop)
  @JoinColumn({ name: 'owner_id' })
  user: Relation<User>;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 150,
    nullable: false,
    unique: true,
  })
  name: string;

  @Column({
    name: 'description',
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  logo_url: string;

  @Column({
    name: 'banner_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  banner_url: string;

  @Column({
    name: 'phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  phone: string;

  @Column({
    name: 'warehouse_address',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  warehouse_address: string;

  @Column({
    name: 'status',
    type: 'enum',
    nullable: false,
    enum: ShopStatus,
    default: ShopStatus.PENDING,
  })
  status: string;

  @Column({
    name: 'reject_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  reject_reason: string;

  @Column({
    name: 'follower_count',
    type: `integer`,
    nullable: false,
    default: 0,
  })
  follower_count: number;

  @Column({
    name: 'approved_at',
    type: `timestamp`,
    nullable: true,
  })
  approved_at: Date;

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
