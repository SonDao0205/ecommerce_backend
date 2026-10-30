import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export type CatalogProductSort = 'price_asc' | 'price_desc';

export class CatalogProductQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'category_id phải là ID dạng số.' })
  category_id?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'shop_id phải là ID dạng số.' })
  shop_id?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(price_asc|price_desc)$/, {
    message: 'sort_by chỉ nhận price_asc hoặc price_desc.',
  })
  sort_by?: CatalogProductSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
