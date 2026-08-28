import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/** Request query chuẩn cho mọi API getAll thuộc management. */
export class GetAllDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm' })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    const rawValue: unknown = value;
    return typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  })
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Bỏ trống để lấy mọi trạng thái',
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    const rawValue: unknown = value;
    if (rawValue === true || rawValue === 'true') return true;
    if (rawValue === false || rawValue === 'false') return false;
    return rawValue;
  })
  @IsBoolean()
  isActive?: boolean;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
