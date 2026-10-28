import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  @Matches(/^\d+$/, { message: 'variant_id phải là số nguyên dương.' })
  variant_id: string;

  @IsOptional()
  @IsInt({ message: 'quantity phải là số nguyên.' })
  @Min(1, { message: 'quantity phải lớn hơn 0.' })
  quantity = 1;
}
