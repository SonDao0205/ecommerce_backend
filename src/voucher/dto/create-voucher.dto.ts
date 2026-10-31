import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  VoucherDiscountType,
  VoucherScope,
} from '../entities/enum/voucher.enum.js';

const MONEY_PATTERN = /^\d{1,13}(?:\.\d{1,2})?$/;

export class CreateVoucherDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9_-]{1,50}$/)
  code: string;

  @IsEnum(VoucherScope)
  scope: VoucherScope;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsEnum(VoucherDiscountType)
  discount_type: VoucherDiscountType;

  @IsString()
  @Matches(MONEY_PATTERN)
  discount_value: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  max_discount_amount?: string | null;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  min_order_value?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usage_limit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usage_per_user?: number;

  @Type(() => Date)
  @IsDate()
  start_at: Date;

  @Type(() => Date)
  @IsDate()
  end_at: Date;
}
