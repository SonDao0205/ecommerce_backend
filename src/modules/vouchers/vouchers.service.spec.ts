import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  VoucherAudience,
  VoucherDiscountType,
  VoucherScope,
  VoucherStatus,
  VoucherType,
} from '@entities';
import { VouchersService } from './vouchers.service';
import { VouchersRepository } from './vouchers.repository';
import { CreateVoucherDto } from './dto/create-voucher.dto';

const payload = (): CreateVoucherDto => ({
  name: 'Sale tháng 9',
  code: 'SALE20',
  status: VoucherStatus.ACTIVE,
  voucherType: VoucherType.ORDER_DISCOUNT,
  discountType: VoucherDiscountType.PERCENTAGE,
  discountValue: 20,
  maxDiscountAmount: 100000,
  minimumOrderAmount: 200000,
  scope: VoucherScope.SHOP,
  audience: VoucherAudience.ALL,
  startAt: new Date(Date.now() - 1000),
  endAt: new Date(Date.now() + 86400000),
  usageLimitPerUser: 1,
  combinableWithVouchers: false,
  combinableWithFlashSale: false,
  combinableWithPromotions: false,
});

describe('VouchersService', () => {
  const repository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as jest.Mocked<VouchersRepository>;
  const service = new VouchersService(repository);

  beforeEach(() => jest.clearAllMocks());

  it('rejects percentage voucher without a maximum discount', async () => {
    const dto = payload();
    delete dto.maxDiscountAmount;
    await expect(service.create(dto, 'admin-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not allow lowering usage limit below used count', async () => {
    repository.findById.mockResolvedValue({
      id: 'voucher-id',
      usedCount: 8,
    } as never);
    const dto = { ...payload(), maxUsageCount: 7 };
    await expect(
      service.update('voucher-id', dto, 'admin-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('uses status update instead of deleting a voucher', async () => {
    repository.findById.mockResolvedValue({
      id: 'voucher-id',
      endAt: new Date(Date.now() + 10000),
    } as never);
    repository.updateStatus.mockResolvedValue({
      id: 'voucher-id',
      status: VoucherStatus.DISABLED,
    } as never);
    await expect(
      service.updateStatus('voucher-id', VoucherStatus.DISABLED, 'admin-id'),
    ).resolves.toEqual(
      expect.objectContaining({ status: VoucherStatus.DISABLED }),
    );
    expect(repository.updateStatus).toHaveBeenCalledWith(
      'voucher-id',
      VoucherStatus.DISABLED,
      'admin-id',
    );
  });

  it('returns 404 for an unknown voucher', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
