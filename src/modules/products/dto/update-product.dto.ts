import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Đường dẫn SEO không được bỏ trống!' })
  slug!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mô tả sản phẩm không được để trống' })
  description!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mã SKU của sản phẩm không được bỏ trống!' })
  sku!: string;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty({ message: 'Giá sản phẩm không được bỏ trống!' })
  unitPrice!: number;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  imageManifest?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  thumbnailIndex?: number;

  @IsString()
  @IsOptional()
  variants?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;
}
