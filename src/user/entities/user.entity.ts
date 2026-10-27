import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, UserStatus } from './enums/user.enum.js';
import { Address } from './address.entity.js';
import { RefreshToken } from '../../auth/entities/refresh-token.entity.js';
import { Shop } from '../../shop/entities/shop.entity.js';
import { ShopFollower } from '../../shop/entities/shop_follower.entity.js';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({
    name: `email`,
    type: `varchar`,
    length: 150,
    nullable: true,
    unique: true,
  })
  @Index()
  email: string | null;

  @Column({
    name: `phone`,
    type: `varchar`,
    length: 20,
    nullable: false,
    unique: true,
  })
  @Index()
  phone: string;

  @Column({
    name: `password_hash`,
    type: `varchar`,
    length: 100,
    nullable: false,
  })
  password_hash: string;

  @Column({
    name: `full_name`,
    type: `varchar`,
    length: 120,
    nullable: false,
  })
  full_name: string;

  @Column({
    name: `avatar_url`,
    type: `varchar`,
    length: 500,
    nullable: true,
  })
  avatar_url: string | null;

  @Column({
    name: `email_verified`,
    type: `smallint`,
    nullable: false,
    default: 0,
  })
  email_verified: number;

  @Column({
    name: `status`,
    type: `varchar`,
    length: 20,
    nullable: false,
    default: UserStatus.ACTIVE,
  })
  status: string;

  @Column({
    name: `role`,
    type: `varchar`,
    length: 100,
    nullable: true,
    default: UserRole.CLIENT,
  })
  role: string;

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

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refresh_tokens: RefreshToken[];

  @OneToOne(() => Shop, (shop) => shop.user)
  shop: Shop;

  @OneToMany(() => ShopFollower, (shopFollower) => shopFollower.user)
  shop_follows: ShopFollower[];
}
