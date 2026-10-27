import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Shop } from './shop.entity.js';
import { User } from '../../user/entities/user.entity.js';

@Entity({ name: 'shop_followers' })
@Index('idx_shop_followers_user', ['user_id'])
export class ShopFollower {
  @PrimaryColumn({ name: 'shop_id', type: 'bigint' })
  shop_id: string;

  @PrimaryColumn({ name: 'user_id', type: 'bigint' })
  user_id: string;

  @ManyToOne(() => Shop, (shop) => shop.followers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shop_id' })
  shop: Relation<Shop>;

  @ManyToOne(() => User, (user) => user.shop_follows, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at: Date;
}
