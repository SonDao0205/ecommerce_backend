import { Transform, TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RejectOrderDto {
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  @MinLength(5, { message: 'Lý do từ chối phải có ít nhất 5 ký tự' })
  @MaxLength(1000)
  reason!: string;
}
