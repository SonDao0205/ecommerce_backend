import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateInventoryStockDto {
  @IsOptional()
  @IsUUID('4', { message: 'Biến thể không hợp lệ' })
  variantId?: string;

  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(0, { message: 'Số lượng không được nhỏ hơn 0' })
  @Max(1_000_000)
  stock!: number;

  @Type(() => Number)
  @IsInt({ message: 'Tồn kho hiện tại không hợp lệ' })
  @Min(0)
  expectedStock!: number;

  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Lý do cập nhật không được để trống' })
  @MinLength(5, { message: 'Lý do cập nhật phải có ít nhất 5 ký tự' })
  @MaxLength(1000)
  reason!: string;
}
