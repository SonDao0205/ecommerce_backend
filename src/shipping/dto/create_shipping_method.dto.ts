import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateShippingMethodDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  base_fee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  estimated_days?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  is_active?: number;
}
