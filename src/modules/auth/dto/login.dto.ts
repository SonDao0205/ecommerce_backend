import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const optionalTrimmedString = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};

export class LoginDto {
  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @Transform(optionalTrimmedString)
  @IsOptional()
  @IsString()
  identifier?: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password!: string;
}
