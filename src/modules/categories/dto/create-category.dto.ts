import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống!' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Đường dẫn SEO không được để trống!' })
  slug!: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsUUID('4', { message: 'Parent ID phải là định dạng UUID hợp lệ!' })
  @IsOptional()
  parentId?: string | null;
}
