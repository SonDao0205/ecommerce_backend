import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../user/entities/user.entity.js';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;
  @Column({
    name: `user_id`,
    type: `bigint`,
    nullable: false,
  })
  @Index()
  user_id: string;
  @ManyToOne(() => User, (user) => user.refresh_tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;
  @Column({
    name: `token_hash`,
    type: `varchar`,
    length: 100,
    nullable: false,
    unique: true,
  })
  token_hash: string;
  @Column({
    name: `expires_at`,
    type: `timestamp`,
    nullable: false,
  })
  expires_at: Date;
  @Column({
    name: `revoked`,
    type: `smallint`,
    nullable: false,
    default: 0,
  })
  revoked: number;

  @CreateDateColumn({
    name: `created_at`,
    type: `timestamp`,
  })
  created_at: Date;
}
