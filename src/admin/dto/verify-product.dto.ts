import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProductReviewStatus } from '../../product/entities/enum/product.enum.js';

export class VerifyProductDto {
  @IsEnum(ProductReviewStatus, {
    message: 'status phải là ACTIVE hoặc REJECTED.',
  })
  status: ProductReviewStatus;

  @IsOptional()
  @IsString({ message: 'reject_reason phải là chuỗi.' })
  @MaxLength(500, { message: 'reject_reason không được vượt quá 500 ký tự.' })
  reject_reason?: string;
}
