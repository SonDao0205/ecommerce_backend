import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingMethod } from './entities/shipping.entity.js';
import { CreateShippingMethodDto } from './dto/create_shipping_method.dto.js';

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(ShippingMethod)
    private readonly shippingMethodRepository: Repository<ShippingMethod>,
  ) {}

  /** Tạo shipping method mới sau khi chuẩn hóa code và name. */
  async createMethod(dto: CreateShippingMethodDto): Promise<ShippingMethod> {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!code || !name) {
      throw new BadRequestException('code và name không được để trống.');
    }

    const method = this.shippingMethodRepository.create({
      code,
      name,
      base_fee: (dto.base_fee ?? 0).toFixed(2),
      estimated_days: dto.estimated_days?.trim() || null,
      is_active: dto.is_active ?? 1,
    });

    try {
      return await this.shippingMethodRepository.save(method);
    } catch (error) {
      this.handleDatabaseError(error, 'Mã vận chuyển đã tồn tại.');
    }
  }

  /** Kích hoạt shipping method bằng cách cập nhật duy nhất is_active. */
  async activeMethod(id: string): Promise<void> {
    await this.setActive(id, 1);
  }

  /** Ngừng kích hoạt shipping method bằng cách cập nhật duy nhất is_active. */
  async unactiveMethod(id: string): Promise<void> {
    await this.setActive(id, 0);
  }

  private async setActive(id: string, isActive: number): Promise<void> {
    this.validateId(id);
    const result = await this.shippingMethodRepository.update(
      { id },
      { is_active: isActive },
    );
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy phương thức vận chuyển.');
    }
  }

  /** Kiểm tra ID đường dẫn là số nguyên dương trước khi truy vấn. */
  private validateId(id: string): void {
    if (!/^[1-9]\d*$/.test(id)) {
      throw new BadRequestException('ID phương thức vận chuyển không hợp lệ.');
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
