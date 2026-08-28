import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống!' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Đường dẫn SEO không được để trống!' })
  slug!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;
}
