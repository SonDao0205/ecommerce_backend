import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';

export class SetVoucherActiveDto {
  @Type(() => Number)
  @IsIn([0, 1])
  is_active: 0 | 1;
}
