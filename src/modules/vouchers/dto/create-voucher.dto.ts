import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  VoucherAudience,
  VoucherDiscountType,
  VoucherScope,
  VoucherStatus,
  VoucherType,
} from '@entities';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateVoucherDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150) name!: string;
  @Transform(upper) @IsString() @IsNotEmpty() @MaxLength(50) code!: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;
  @IsEnum(VoucherStatus) status!: VoucherStatus;
  @IsEnum(VoucherType) voucherType!: VoucherType;
  @IsEnum(VoucherDiscountType) discountType!: VoucherDiscountType;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discountValue!: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  maxDiscountAmount?: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumOrderAmount = 0;
  @IsEnum(VoucherScope) scope!: VoucherScope;
  @IsEnum(VoucherAudience) audience!: VoucherAudience;
  @Type(() => Date) @IsDate() startAt!: Date;
  @Type(() => Date) @IsDate() endAt!: Date;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) issuedQuantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUsageCount?: number;
  @Type(() => Number) @IsInt() @Min(1) usageLimitPerUser = 1;
  @IsBoolean() combinableWithVouchers = false;
  @IsBoolean() combinableWithFlashSale = false;
  @IsBoolean() combinableWithPromotions = false;
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  productIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  categoryIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  customerIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  memberGroupIds?: string[];
}
