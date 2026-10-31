import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const MONEY_PATTERN = /^\d{1,13}(?:\.\d{1,2})?$/;

export class ApplyVouchersDto {
  @IsString()
  @Matches(MONEY_PATTERN)
  subtotal: string;

  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((code) =>
          typeof code === 'string' ? code.trim().toUpperCase() : code,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[A-Z0-9_-]{1,50}$/, { each: true })
  voucher_codes: string[] = [];

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  shop_id?: string;
}
