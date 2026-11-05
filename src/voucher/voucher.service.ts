import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ShopService } from '../shop/shop.service.js';
import { UserRole } from '../user/entities/enums/user.enum.js';
import { CreateVoucherDto } from './dto/create-voucher.dto.js';
import { SetVoucherActiveDto } from './dto/set-voucher-active.dto.js';
import { UpdateVoucherDto } from './dto/update-voucher.dto.js';
import { Voucher } from './entities/voucher.entity.js';
import { VoucherScope } from './entities/enum/voucher.enum.js';
import { VoucherDiscountType } from './entities/enum/voucher.enum.js';
import { ApplyVouchersDto } from './dto/apply-vouchers.dto.js';

export type VoucherActor = { id: string; role: string };

@Injectable()
export class VoucherService {
  constructor(
    @InjectRepository(Voucher)
    private readonly voucherRepository: Repository<Voucher>,
    private readonly dataSource: DataSource,
    private readonly shopService: ShopService,
  ) {}

  /**
   * Tính giá dự kiến cho client; không ghi usage_count hay voucher_usages vì
   * voucher chỉ thực sự được tiêu thụ khi đơn hàng được tạo.
   * Các mã được áp dụng tuần tự theo thứ tự trong voucher_codes. Điều kiện
   * min_order_value luôn dựa trên subtotal ban đầu; discount tính trên số dư.
   */
  applyVouchers = async (dto: ApplyVouchersDto, actor: VoucherActor) => {
    if (actor.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Chỉ khách hàng mới được áp dụng voucher.');
    }
    this.assertNonNegativeAmount(dto.subtotal, 'subtotal');

    const codes = dto.voucher_codes.map((code) => code.trim().toUpperCase());
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('Không được áp dụng trùng mã voucher.');
    }

    const originalSubtotalCents = this.toCents(dto.subtotal);
    if (codes.length === 0) {
      return {
        subtotal: this.fromCents(originalSubtotalCents),
        total_discount: '0.00',
        final_amount: this.fromCents(originalSubtotalCents),
        applied_vouchers: [],
      };
    }

    const found = await this.voucherRepository.find({
      where: { code: In(codes) },
    });
    const voucherByCode = new Map<string, Voucher>(
      found.map((voucher) => [voucher.code, voucher] as const),
    );
    const vouchers = codes.map((code) => {
      const voucher = voucherByCode.get(code);
      if (!voucher) {
        throw new BadRequestException(`Mã voucher ${code} không tồn tại.`);
      }
      return voucher;
    });

    let remainingCents = originalSubtotalCents;
    const now = new Date();
    let shopValidated = false;
    const appliedVouchers: Array<{
      code: string;
      discount_amount: string;
      amount_after_discount: string;
    }> = [];

    for (const voucher of vouchers) {
      if (voucher.is_active !== 1) {
        throw new BadRequestException(`Voucher ${voucher.code} đang tắt.`);
      }
      if (now < voucher.start_at || now > voucher.end_at) {
        throw new BadRequestException(
          `Voucher ${voucher.code} chưa đến hạn hoặc đã hết hạn.`,
        );
      }
      if (
        voucher.usage_limit !== null &&
        voucher.used_count >= voucher.usage_limit
      ) {
        throw new BadRequestException(
          `Voucher ${voucher.code} đã hết lượt sử dụng.`,
        );
      }
      if (originalSubtotalCents < this.toCents(voucher.min_order_value)) {
        throw new BadRequestException(
          `Đơn hàng chưa đạt giá trị tối thiểu của voucher ${voucher.code}.`,
        );
      }
      if (voucher.scope === VoucherScope.SHOP) {
        if (!dto.shop_id || voucher.shop_id !== dto.shop_id) {
          throw new BadRequestException(
            `Voucher ${voucher.code} không áp dụng cho shop này.`,
          );
        }
        if (!shopValidated) {
          await this.shopService.getPublicShopDetail(dto.shop_id);
          shopValidated = true;
        }
      }

      const usageRows = (await this.dataSource.query(
        `SELECT COUNT(*)::int AS count
         FROM voucher_usages
         WHERE voucher_id = $1 AND user_id = $2`,
        [voucher.id, actor.id],
      )) as Array<{ count: number | string }>;
      if (Number(usageRows[0]?.count ?? 0) >= voucher.usage_per_user) {
        throw new BadRequestException(
          `Bạn đã dùng hết số lượt của voucher ${voucher.code}.`,
        );
      }

      let discountCents: bigint;
      if (voucher.discount_type === VoucherDiscountType.PERCENT) {
        this.assertDiscountValue(
          VoucherDiscountType.PERCENT,
          voucher.discount_value,
        );
        const percentHundredths = this.toCents(voucher.discount_value);
        discountCents = (remainingCents * percentHundredths + 5_000n) / 10_000n;
        if (voucher.max_discount_amount !== null) {
          const maxDiscountCents = this.toCents(voucher.max_discount_amount);
          discountCents =
            discountCents < maxDiscountCents ? discountCents : maxDiscountCents;
        }
      } else {
        this.assertDiscountValue(
          VoucherDiscountType.FIXED,
          voucher.discount_value,
        );
        discountCents = this.toCents(voucher.discount_value);
      }

      discountCents =
        discountCents < remainingCents ? discountCents : remainingCents;
      remainingCents -= discountCents;
      appliedVouchers.push({
        code: voucher.code,
        discount_amount: this.fromCents(discountCents),
        amount_after_discount: this.fromCents(remainingCents),
      });
    }

    return {
      subtotal: this.fromCents(originalSubtotalCents),
      total_discount: this.fromCents(originalSubtotalCents - remainingCents),
      final_amount: this.fromCents(remainingCents),
      applied_vouchers: appliedVouchers,
    };
  };

  /** Chọn voucher sàn đủ điều kiện để order áp dụng tự động. */
  async findAutomaticPlatformVoucher(subtotal: string, userId: string) {
    const now = new Date();
    const candidates = await this.voucherRepository.find({
      where: { scope: VoucherScope.PLATFORM, is_active: 1 },
      order: { created_at: 'ASC' },
    });
    for (const voucher of candidates) {
      if (
        now < voucher.start_at ||
        now > voucher.end_at ||
        this.toCents(subtotal) < this.toCents(voucher.min_order_value) ||
        (voucher.usage_limit !== null &&
          voucher.used_count >= voucher.usage_limit)
      ) {
        continue;
      }
      const rows = (await this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM voucher_usages
         WHERE voucher_id = $1 AND user_id = $2`,
        [voucher.id, userId],
      )) as Array<{ count: number | string }>;
      if (Number(rows[0]?.count ?? 0) < voucher.usage_per_user) return voucher;
    }
    return null;
  }

  create = async (dto: CreateVoucherDto, actor: VoucherActor) => {
    this.assertValidWindow(dto.start_at, dto.end_at);
    this.assertDiscountValue(dto.discount_type, dto.discount_value);
    if (dto.min_order_value !== undefined) {
      this.assertNonNegativeAmount(dto.min_order_value, 'min_order_value');
    }
    if (dto.max_discount_amount != null) {
      this.assertNonNegativeAmount(
        dto.max_discount_amount,
        'max_discount_amount',
      );
    }

    let shopId: string | null = null;
    if (dto.scope === VoucherScope.PLATFORM) {
      if (actor.role !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Chỉ admin mới được tạo voucher toàn sàn.',
        );
      }
    } else {
      if (actor.role !== UserRole.SELLER) {
        throw new ForbiddenException(
          'Voucher của shop chỉ được tạo bởi seller.',
        );
      }
      const shop = await this.shopService.getActiveShopByOwnerId(actor.id);
      shopId = shop.id;
    }

    const code = dto.code.trim().toUpperCase();
    if (await this.voucherRepository.findOne({ where: { code } })) {
      throw new ConflictException('Mã voucher đã tồn tại.');
    }

    const voucher = this.voucherRepository.create({
      scope: dto.scope,
      title: dto.title,
      description: dto.description,
      discount_type: dto.discount_type,
      discount_value: dto.discount_value,
      max_discount_amount: dto.max_discount_amount,
      min_order_value: dto.min_order_value,
      usage_limit: dto.usage_limit,
      usage_per_user: dto.usage_per_user,
      start_at: dto.start_at,
      end_at: dto.end_at,
      code,
      shop_id: shopId,
      created_by: actor.id,
    });
    return this.saveVoucher(voucher);
  };

  update = async (
    voucherId: string,
    dto: UpdateVoucherDto,
    actor: VoucherActor,
  ) => {
    if (Object.prototype.hasOwnProperty.call(dto, 'scope')) {
      throw new BadRequestException('Không được thay đổi scope của voucher.');
    }
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Không có thông tin nào để cập nhật.');
    }

    const voucher = await this.getManageableVoucher(voucherId, actor);
    const startAt = dto.start_at ?? voucher.start_at;
    const endAt = dto.end_at ?? voucher.end_at;
    this.assertValidWindow(startAt, endAt);

    this.assertDiscountValue(
      dto.discount_type ?? voucher.discount_type,
      dto.discount_value ?? voucher.discount_value,
    );
    if (dto.min_order_value !== undefined) {
      this.assertNonNegativeAmount(dto.min_order_value, 'min_order_value');
    }
    if (dto.max_discount_amount != null) {
      this.assertNonNegativeAmount(
        dto.max_discount_amount,
        'max_discount_amount',
      );
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      const existing = await this.voucherRepository.findOne({
        where: { code },
      });
      if (existing && existing.id !== voucher.id) {
        throw new ConflictException('Mã voucher đã tồn tại.');
      }
      dto.code = code;
    }

    Object.assign(voucher, dto);
    return this.saveVoucher(voucher);
  };

  setActive = async (
    voucherId: string,
    dto: SetVoucherActiveDto,
    actor: VoucherActor,
  ) => {
    const voucher = await this.getManageableVoucher(voucherId, actor);
    voucher.is_active = dto.is_active;
    return this.voucherRepository.save(voucher);
  };

  /** Xóa mềm: voucher và lịch sử sử dụng được giữ lại, chỉ chuyển sang inactive. */
  deactivate = async (voucherId: string, actor: VoucherActor) => {
    const voucher = await this.getManageableVoucher(voucherId, actor);
    voucher.is_active = 0;
    return this.voucherRepository.save(voucher);
  };

  private async getManageableVoucher(
    voucherId: string,
    actor: VoucherActor,
  ): Promise<Voucher> {
    if (!/^\d+$/.test(voucherId)) {
      throw new BadRequestException('ID voucher không hợp lệ.');
    }

    const voucher = await this.voucherRepository.findOne({
      where: { id: voucherId },
    });
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher.');

    if (actor.role === UserRole.ADMIN) return voucher;
    if (actor.role !== UserRole.SELLER || voucher.scope !== VoucherScope.SHOP) {
      throw new ForbiddenException('Bạn không có quyền quản lý voucher này.');
    }

    const shop = await this.shopService.getActiveShopByOwnerId(actor.id);
    if (shop.id !== voucher.shop_id) {
      throw new ForbiddenException('Voucher không thuộc shop của bạn.');
    }
    return voucher;
  }

  private assertValidWindow(startAt: Date, endAt: Date): void {
    if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('start_at không hợp lệ.');
    }
    if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('end_at không hợp lệ.');
    }
    if (endAt <= startAt) {
      throw new BadRequestException('end_at phải sau start_at.');
    }
  }

  private assertPositiveAmount(value: string, field: string): void {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
      throw new BadRequestException(`${field} phải lớn hơn 0.`);
    }
  }

  private assertDiscountValue(type: VoucherDiscountType, value: string): void {
    this.assertPositiveAmount(value, 'discount_value');
    if (type === VoucherDiscountType.PERCENT && Number(value) > 100) {
      throw new BadRequestException(
        'discount_value của voucher phần trăm không được vượt quá 100.',
      );
    }
  }

  private assertNonNegativeAmount(value: string, field: string): void {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new BadRequestException(`${field} không được âm.`);
    }
  }

  private toCents(value: string): bigint {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  }

  private fromCents(value: bigint): string {
    const whole = value / 100n;
    const fraction = String(value % 100n).padStart(2, '0');
    return `${whole}.${fraction}`;
  }

  private async saveVoucher(voucher: Voucher): Promise<Voucher> {
    try {
      return await this.voucherRepository.save(voucher);
    } catch (error) {
      if (
        (error as { code?: string; constraint?: string })?.code === '23505' &&
        (error as { constraint?: string })?.constraint === 'uq_vouchers_code'
      ) {
        throw new ConflictException('Mã voucher đã tồn tại.');
      }
      throw error;
    }
  }
}
