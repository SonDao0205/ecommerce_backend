import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateProductVariantDto } from './product-variant.dto.js';
import { ProductStatus } from '../entities/enum/product.enum.js';

const MONEY_PATTERN = /^\d{1,13}(?:\.\d{1,2})?$/;

function parseJsonArray(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i)
  @MaxLength(300)
  slug: string;

  @IsString()
  @Matches(/^\d+$/)
  category_id: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  brand_id?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  price: string;

  @IsOptional()
  @IsIn([ProductStatus.DRAFT, ProductStatus.PENDING])
  status?: ProductStatus.DRAFT | ProductStatus.PENDING;

  @IsOptional()
  @Transform(({ value }) => parseJsonArray(value))
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];
}
