import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum VoucherPreviewMode {
  CART = 'cart',
  BUY_NOW = 'buy_now',
}
const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class VoucherPreviewDto {
  @Transform(trim) @IsString() @MaxLength(50) code!: string;
  @IsEnum(VoucherPreviewMode) mode!: VoucherPreviewMode;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  productSku?: string;
  @IsOptional() @IsUUID() variantId?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  variantSku?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(99) quantity?: number;
}
