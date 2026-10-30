import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from './entities/payment-method.entity.js';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto.js';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  /** Tạo payment method mới sau khi chuẩn hóa code và name. */
  async createMethod(dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!code || !name) {
      throw new BadRequestException('code và name không được để trống.');
    }

    const method = this.paymentMethodRepository.create({
      code,
      name,
      is_active: dto.is_active ?? 1,
      sort_order: dto.sort_order ?? 0,
    });

    try {
      return await this.paymentMethodRepository.save(method);
    } catch (error) {
      this.handleDatabaseError(error, 'Mã thanh toán đã tồn tại.');
    }
  }

  /** Kích hoạt payment method bằng cách cập nhật duy nhất is_active. */
  async activeMethod(id: string): Promise<void> {
    await this.setActive(id, 1);
  }

  /** Ngừng kích hoạt payment method bằng cách cập nhật duy nhất is_active. */
  async unactiveMethod(id: string): Promise<void> {
    await this.setActive(id, 0);
  }

  private async setActive(id: string, isActive: number): Promise<void> {
    this.validateId(id);
    const result = await this.paymentMethodRepository.update(
      { id },
      { is_active: isActive },
    );
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy phương thức thanh toán.');
    }
  }

  /** Kiểm tra ID đường dẫn là số nguyên dương trước khi truy vấn. */
  private validateId(id: string): void {
    if (!/^[1-9]\d*$/.test(id)) {
      throw new BadRequestException('ID phương thức thanh toán không hợp lệ.');
    }
  }

  /** Đổi lỗi unique của database thành phản hồi xung đột dễ hiểu. */
  private handleDatabaseError(error: unknown, duplicateMessage: string): never {
    if (this.getDatabaseErrorCode(error) === '23505') {
      throw new ConflictException(duplicateMessage);
    }
    throw error;
  }

  /** Lấy mã lỗi PostgreSQL từ exception TypeORM. */
  private getDatabaseErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const dbError = error as {
      code?: string;
      driverError?: { code?: string };
    };
    return dbError.driverError?.code ?? dbError.code;
  }
}
