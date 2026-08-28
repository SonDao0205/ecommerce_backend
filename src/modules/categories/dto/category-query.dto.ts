import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { GetAllDto } from 'src/database/dtos/common/get_all.dto';

/** Query riêng cho cây category, vẫn kế thừa contract getAll management. */
export class CategoryQueryDto extends GetAllDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Lấy các category con trực tiếp của parent này',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Chỉ lấy category gốc có parentId IS NULL',
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    const rawValue: unknown = value;
    if (rawValue === true || rawValue === 'true') return true;
    if (rawValue === false || rawValue === 'false') return false;
    return rawValue;
  })
  @IsBoolean()
  rootOnly?: boolean;
}
