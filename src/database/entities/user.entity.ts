import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * User Entity: Lưu trữ thông tin tài khoản người dùng và thông tin xác thực.
 * - Độc lập hoàn toàn, không lưu mảng quan hệ ngược để tránh truy vấn nặng khi serialize.
 */
@Entity('users')
export class User extends BaseEntity {
  // Email duy nhất dùng để đăng nhập, đánh Index để tối ưu tìm kiếm
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email?: string | null;

  // Mật khẩu đã băm (hash bcrypt), select: false để không vô tình leak khi query thông thường
  @Column({ type: 'varchar', length: 255, select: false })
  password?: string;

  // Họ và tên người dùng
  @Column({ name: 'full_name', type: 'varchar', length: 150, nullable: true })
  fullName?: string;

  // Số điện thoại liên hệ
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  // Trạng thái tài khoản (true: hoạt động, false: bị khóa)
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive?: boolean;

  // Đường dẫn ảnh đại diện
  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string;

  // Refresh Token đã băm để cấp lại Access Token mới khi hết hạn (bảo mật cao)
  @Column({
    name: 'refresh_token',
    type: 'text',
    nullable: true,
    select: false,
  })
  refreshToken?: string | null;
}
