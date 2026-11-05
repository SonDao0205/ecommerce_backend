import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  product_variant_id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  address_id!: string;

  @IsString()
  @IsNotEmpty()
  payment_method_id!: string;

  @IsString()
  @IsNotEmpty()
  shipping_method_id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  voucher_codes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customer_note?: string;
}
