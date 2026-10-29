import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from '../user/user.service.js';
import { ProductService } from '../product/product.service.js';
import { VerifyProductDto } from './dto/verify-product.dto.js';
import {
  ProductReviewStatus,
  ProductStatus,
} from '../product/entities/enum/product.enum.js';

@Injectable()
export class AdminService {
  constructor(
    @Inject() private readonly userService: UserService,
    private readonly productService: ProductService,
  ) {}

  verifySeller = async (seller_id: string) => {
    return this.userService.updateEmailVerify(seller_id);
  };

  /**
   * Kiểm tra quy tắc duyệt và quyết định trạng thái sản phẩm.
   * ProductService chỉ được gọi để đọc/lưu dữ liệu qua database.
   */
  verifyProduct = async (productId: string, dto: VerifyProductDto) => {
    if (!/^\d+$/.test(productId)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ.');
    }

    const hasRejectReason = Object.prototype.hasOwnProperty.call(
      dto,
      'reject_reason',
    );
    if (dto.status === ProductReviewStatus.ACTIVE && hasRejectReason) {
      throw new BadRequestException(
        'Không được gửi reject_reason khi duyệt sản phẩm ACTIVE.',
      );
    }

    const rejectReason = dto.reject_reason?.trim();
    if (
      dto.status === ProductReviewStatus.REJECTED &&
      (!rejectReason || rejectReason.length > 500)
    ) {
      throw new BadRequestException(
        'Cần cung cấp reject_reason từ 1 đến 500 ký tự khi từ chối sản phẩm.',
      );
    }

    const product = await this.productService.findForVerification(productId);
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm.');

    product.status =
      dto.status === ProductReviewStatus.ACTIVE
        ? ProductStatus.ACTIVE
        : ProductStatus.REJECTED;
    product.reject_reason =
      dto.status === ProductReviewStatus.REJECTED ? rejectReason! : null;

    return this.productService.saveProduct(product);
  };
}
