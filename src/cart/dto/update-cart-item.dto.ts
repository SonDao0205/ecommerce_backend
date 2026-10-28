import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt({ message: 'quantity phải là số nguyên.' })
  @Min(1, { message: 'quantity phải lớn hơn 0.' })
  quantity: number;
}
