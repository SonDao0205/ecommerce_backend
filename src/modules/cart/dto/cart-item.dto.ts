import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CartItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  productSku?: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  variantSku?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
