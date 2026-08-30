import { IsEnum, IsOptional } from 'class-validator';
import { VoucherDiscountType, VoucherStatus } from '@entities';
import { GetAllDto } from 'src/database/dtos/common/get_all.dto';

export class VoucherQueryDto extends GetAllDto {
  @IsOptional() @IsEnum(VoucherStatus) status?: VoucherStatus;
  @IsOptional() @IsEnum(VoucherDiscountType) discountType?: VoucherDiscountType;
}
