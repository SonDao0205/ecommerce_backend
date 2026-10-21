import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, UserStatus } from './enums/user.enum.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  @Index()
  id: string;

  @Column({
    name: `name`,
    type: `varchar`,
    length: 255,
    nullable: false,
  })
  name: string;

  @Column({
    name: `email`,
    type: `varchar`,
    length: 255,
    nullable: true,
  })
  @Index()
  email: string;

  @Column({
    name: `phone`,
    type: `varchar`,
    length: 10,
    nullable: false,
  })
  @Index()
  phone: string;

  @Column({
    name: `password`,
    type: `varchar`,
    length: 255,
    nullable: false,
  })
  password: string;

  @Column({
    name: `role`,
    type: `varchar`,
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: string;

  @Column({
    name: `status`,
    type: `varchar`,
    enum: UserStatus,
    default: UserStatus.AVAILABLE,
  })
  status: string;

  @CreateDateColumn({
    name: `created_at`,
    type: `timestamptz`,
  })
  created_at: Date;

  @UpdateDateColumn({
    name: `updated_at`,
    type: `timestamptz`,
  })
  updated_at: Date;
}
