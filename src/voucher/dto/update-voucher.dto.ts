import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateVoucherDto } from './create-voucher.dto.js';

/** Scope được loại khỏi DTO để không thể thay đổi sau khi voucher được tạo. */
export class UpdateVoucherDto extends PartialType(
  OmitType(CreateVoucherDto, ['scope'] as const),
) {}
