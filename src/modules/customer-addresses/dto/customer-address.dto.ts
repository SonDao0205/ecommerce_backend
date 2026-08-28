import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCustomerAddressDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  @MaxLength(150)
  recipientName!: string;

  @Transform(trimString)
  @IsString()
  @Matches(/^(?:\+84|0)\d{9,10}$/, {
    message: 'Số điện thoại không đúng định dạng',
  })
  @MaxLength(20)
  phone!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  @MaxLength(1000)
  address!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  @MaxLength(150)
  recipientName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Matches(/^(?:\+84|0)\d{9,10}$/, {
    message: 'Số điện thoại không đúng định dạng',
  })
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  @MaxLength(1000)
  address?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
