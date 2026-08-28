import { IsEnum, IsOptional } from 'class-validator';
import { GetAllDto } from 'src/database/dtos/common/get_all.dto';
import { OrderStatus } from '@entities';

export class OrderQueryDto extends GetAllDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
