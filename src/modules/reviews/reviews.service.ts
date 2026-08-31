import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ManagementReviewQueryDto,
  ProductReviewQueryDto,
} from './dto/review-query.dto';
import { ReviewCreationError, ReviewsRepository } from './reviews.repository';

@Injectable()
export class ReviewsService {
  constructor(private readonly repository: ReviewsRepository) {}
  async create(userId: string, dto: CreateReviewDto) {
    this.assertOwnedMedia(userId, dto.media);
    try {
      return await this.repository.create(userId, dto);
    } catch (error) {
      if (error instanceof ReviewCreationError)
        throw new BadRequestException(error.message);
      if (this.pgCode(error) === '23505')
        throw new ConflictException(
          'Sản phẩm trong đơn hàng này đã được đánh giá!',
        );
      throw error;
    }
  }
  async getProductReviews(slug: string, query: ProductReviewQueryDto) {
    const result = await this.repository.findProductReviews(slug, query);
    if (!result) throw new NotFoundException('Không tìm thấy sản phẩm!');
    return result;
  }
  getManagement(query: ManagementReviewQueryDto) {
    return this.repository.findManagement(query);
  }
  async reply(id: string, reply: string, actorId: string) {
    const review = await this.repository.reply(id, reply, actorId);
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá!');
    return review;
  }
  private assertOwnedMedia(userId: string, media: CreateReviewDto['media']) {
    const prefix = `ecommerce/reviews/${userId}/`;
    const invalid = media.some((asset) => {
      try {
        const url = new URL(asset.url);
        return (
          url.protocol !== 'https:' ||
          url.hostname !== 'res.cloudinary.com' ||
          !asset.publicId.startsWith(prefix) ||
          !url.pathname.includes(`/ecommerce/reviews/${userId}/`)
        );
      } catch {
        return true;
      }
    });
    if (invalid)
      throw new BadRequestException(
        'Media đánh giá không thuộc tài khoản hiện tại!',
      );
  }
  private pgCode(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : undefined;
  }
}
