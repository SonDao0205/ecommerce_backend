import { IsEnum } from 'class-validator';
import { VoucherStatus } from '@entities';
export class UpdateVoucherStatusDto {
  @IsEnum(VoucherStatus) status!: VoucherStatus;
}
