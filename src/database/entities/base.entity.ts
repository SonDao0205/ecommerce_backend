import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * BaseEntity: Lớp trừu tượng cha chứa các trường dùng chung cho toàn bộ bảng trong DB.
 * - Cung cấp ID định dạng UUID v4 tự động sinh.
 * - Tự động ghi nhận thời gian tạo (createdAt) và thời gian cập nhật (updatedAt).
 * - Hỗ trợ Xóa mềm (Soft Delete) qua cột deletedAt để bảo toàn dữ liệu liên kết.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  // Thời gian tạo bản ghi
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date;

  // Thời gian cập nhật bản ghi gần nhất
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt?: Date;

  // Thời gian xóa mềm (nếu null là bản ghi đang hoạt động, có giá trị là đã bị xóa mềm)
  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt?: Date;
}
