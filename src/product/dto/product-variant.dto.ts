import { Transform, Type } from 'class-transformer';
import { ProductVariantStatus } from '../entities/enum/product.enum.js';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const MONEY_PATTERN = /^\d{1,13}(?:\.\d{1,2})?$/;

export class ProductVariantAttributeDto {
  @IsString()
  @Matches(/^\d+$/)
  attribute_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  value: string;
}

function parseJsonArray(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  price: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsIn([ProductVariantStatus.ACTIVE, ProductVariantStatus.INACTIVE])
  status?: ProductVariantStatus;

  @IsOptional()
  @Transform(({ value }) => parseJsonArray(value))
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantAttributeDto)
  attributes?: ProductVariantAttributeDto[];

  /** Index of this variant's image in the multipart `variant_images` files. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  image_file_index?: number;
}

export class UpdateProductVariantDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  price?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsIn([ProductVariantStatus.ACTIVE, ProductVariantStatus.INACTIVE])
  status?: ProductVariantStatus;

  @IsOptional()
  @Transform(({ value }) => parseJsonArray(value))
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantAttributeDto)
  attributes?: ProductVariantAttributeDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  image_file_index?: number;
}
