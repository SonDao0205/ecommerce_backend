import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { CartItem } from './cart-item.entity';

/**
 * Cart Entity: Đại diện cho giỏ hàng của từng khách hàng.
 * - Mỗi khách hàng sở hữu tối đa 1 giỏ hàng duy nhất (1-1 logic thông qua Unique userId).
 */
@Entity('carts')
export class Cart extends BaseEntity {
  // ID người sở hữu giỏ hàng
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @OneToMany(() => CartItem, (item) => item.cart)
  items?: CartItem[];
}
