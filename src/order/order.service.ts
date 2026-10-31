import { Injectable } from '@nestjs/common';
import { VoucherService, VoucherActor } from '../voucher/voucher.service.js';
import { OrderPriceInput } from './dto/voucher_appy.dto.js';

@Injectable()
export class OrderService {
  constructor(private readonly voucherService: VoucherService) {}

  /**
   * Điểm tính giá duy nhất cho Order: luôn gọi VoucherService, kể cả khi
   * order không chọn voucher. OrderService phải truyền subtotal đã tự tính
   * từ sản phẩm/variant và không tin giá do client gửi lên.
   */
  calculateOrderPrice = async (input: OrderPriceInput, actor: VoucherActor) => {
    return this.voucherService.applyVouchers(
      {
        subtotal: input.subtotal,
        voucher_codes: input.voucher_codes ?? [],
        shop_id: input.shop_id,
      },
      actor,
    );
  };
}
