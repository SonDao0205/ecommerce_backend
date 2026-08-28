import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class ValidateProductSkusDto {
  @IsString()
  sku!: string;

  @IsArray()
  @IsString({ each: true })
  variantSkus!: string[];

  @IsOptional()
  @IsUUID()
  productId?: string;
}
