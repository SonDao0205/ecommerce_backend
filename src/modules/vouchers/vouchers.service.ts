import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  VoucherAudience,
  VoucherDiscountType,
  VoucherScope,
  VoucherStatus,
} from '@entities';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { VouchersRepository } from './vouchers.repository';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { VoucherQueryDto } from './dto/voucher-query.dto';

@Injectable()
export class VouchersService {
  constructor(private readonly repository: VouchersRepository) {}

  getCustomerOptions() {
    return this.repository.getCustomerOptions();
  }

  getMemberGroupOptions() {
    return this.repository.getMemberGroupOptions();
  }

  findAll(query: VoucherQueryDto) {
    return this.repository.findAll(query);
  }

  async findById(id: string) {
    const voucher = await this.repository.findById(id);
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher!');
    return voucher;
  }

  async create(dto: CreateVoucherDto, actorId: string) {
    this.validate(dto);
    try {
      return await this.repository.create(dto, actorId);
    } catch (error) {
      if (this.pgCode(error) === '23505')
        throw new ConflictException('Mã voucher đã tồn tại!');
      if (this.pgCode(error) === '23503')
        throw new BadRequestException(
          'Sản phẩm, danh mục, khách hàng hoặc nhóm thành viên không tồn tại!',
        );
      throw error;
    }
  }

  async update(id: string, dto: UpdateVoucherDto, actorId: string) {
    const current = await this.findById(id);
    this.validate(dto, current.usedCount ?? 0);
    try {
      const voucher = await this.repository.update(id, dto, actorId);
      if (!voucher) throw new NotFoundException('Không tìm thấy voucher!');
      return voucher;
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateStatus(id: string, status: VoucherStatus, actorId: string) {
    const current = await this.findById(id);
    if (status === VoucherStatus.ACTIVE && current.endAt! <= new Date())
      throw new BadRequestException('Không thể kích hoạt voucher đã hết hạn!');
    const voucher = await this.repository.updateStatus(id, status, actorId);
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher!');
    return voucher;
  }

  private validate(dto: CreateVoucherDto, usedCount = 0): void {
    if (dto.endAt <= dto.startAt)
      throw new BadRequestException('endAt phải sau startAt!');
    if (dto.status === VoucherStatus.ACTIVE && dto.endAt <= new Date())
      throw new BadRequestException('Không thể kích hoạt voucher đã hết hạn!');
    if (
      dto.discountType === VoucherDiscountType.PERCENTAGE &&
      dto.maxDiscountAmount == null
    )
      throw new BadRequestException(
        'Voucher phần trăm phải có mức giảm tối đa!',
      );
    if (
      dto.discountType === VoucherDiscountType.PERCENTAGE &&
      dto.discountValue > 100
    )
      throw new BadRequestException('Phần trăm giảm không được vượt quá 100!');
    if (dto.scope === VoucherScope.PRODUCTS && !dto.productIds?.length)
      throw new BadRequestException(
        'Phạm vi sản phẩm cần ít nhất một productId!',
      );
    if (dto.scope === VoucherScope.CATEGORIES && !dto.categoryIds?.length)
      throw new BadRequestException(
        'Phạm vi danh mục cần ít nhất một categoryId!',
      );
    if (
      dto.scope === VoucherScope.SHOP &&
      (dto.productIds?.length || dto.categoryIds?.length)
    )
      throw new BadRequestException(
        'Voucher toàn shop không nhận productIds/categoryIds!',
      );
    if (
      dto.audience === VoucherAudience.SPECIFIC_CUSTOMERS &&
      !dto.customerIds?.length
    )
      throw new BadRequestException('Cần ít nhất một khách hàng cụ thể!');
    if (
      dto.audience === VoucherAudience.MEMBER_GROUPS &&
      !dto.memberGroupIds?.length
    )
      throw new BadRequestException('Cần ít nhất một nhóm thành viên!');
    if (
      dto.maxUsageCount &&
      dto.issuedQuantity &&
      dto.maxUsageCount > dto.issuedQuantity
    )
      throw new BadRequestException(
        'Tổng lượt sử dụng không thể lớn hơn số voucher phát hành!',
      );
    if (dto.maxUsageCount != null && dto.maxUsageCount < usedCount)
      throw new BadRequestException(
        'Tổng lượt sử dụng không thể nhỏ hơn số lượt đã dùng!',
      );
    if (dto.issuedQuantity != null && dto.issuedQuantity < usedCount)
      throw new BadRequestException(
        'Số voucher phát hành không thể nhỏ hơn số lượt đã dùng!',
      );
  }

  private rethrowPersistenceError(error: unknown): never {
    if (this.pgCode(error) === '23505')
      throw new ConflictException('Mã voucher đã tồn tại!');
    if (this.pgCode(error) === '23503')
      throw new BadRequestException(
        'Sản phẩm, danh mục, khách hàng hoặc nhóm thành viên không tồn tại!',
      );
    throw error;
  }

  private pgCode(error: unknown): string | undefined {
    return typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
      ? error.code
      : undefined;
  }
}
