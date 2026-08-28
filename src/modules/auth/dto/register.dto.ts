import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const optionalTrimmedString = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};

const trimmedString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(255)
  email?: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự trở lên' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password!: string;

  @Transform(trimmedString)
  @IsString()
  @IsNotEmpty({ message: 'Tên đầy đủ không được để trống' })
  @MaxLength(150)
  fullName!: string;

  @Transform(trimmedString)
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @MaxLength(20)
  phone!: string;
}
