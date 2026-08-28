import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateOrderFromCartDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  @MaxLength(150)
  recipientName!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại người nhận không được để trống' })
  @MaxLength(20)
  recipientPhone!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ giao hàng không được để trống' })
  @MaxLength(1000)
  shippingAddress!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class BuyNowOrderDto extends CreateOrderFromCartDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  productSku?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  variantSku?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
