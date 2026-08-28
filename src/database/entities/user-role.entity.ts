import { Column, Entity, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Role } from './role.entity';

/**
 * UserRole Entity: Bảng trung gian nối quan hệ N-N giữa User và Role.
 * - Một người dùng có thể sở hữu nhiều quyền hạn (ví dụ vừa là STAFF vừa là WAREHOUSE).
 * - Sử dụng khóa ngoại riêng biệt `userId` & `roleId` để tối ưu hiệu năng thao tác.
 */
@Entity('user_roles')
@Unique(['userId', 'roleId']) // Tránh gán trùng một quyền cho cùng một người dùng
export class UserRole extends BaseEntity {
  // Cột khóa ngoại thật trong PostgreSQL trỏ đến ID của User
  @Column({ name: 'user_id', type: 'uuid' })
  userId?: string;

  // Thuộc tính quan hệ TypeORM ánh xạ vào user_id để hỗ trợ JOIN và cascade delete
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Cột khóa ngoại thật trong PostgreSQL trỏ đến ID của Role
  @Column({ name: 'role_id', type: 'uuid' })
  roleId?: string;

  // Thuộc tính quan hệ TypeORM ánh xạ vào role_id để hỗ trợ JOIN thông tin Role
  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role?: Role;
}
