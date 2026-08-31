import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewCreationError, ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const repository = {
    create: jest.fn(),
    findProductReviews: jest.fn(),
    findManagement: jest.fn(),
    reply: jest.fn(),
  } as unknown as jest.Mocked<ReviewsRepository>;
  const service = new ReviewsService(repository);
  const dto = (): CreateReviewDto => ({
    orderItemId: 'b3c043ec-38e9-4bd3-b3f5-6cbf3f005cb9',
    rating: 5,
    content: 'Sản phẩm rất tốt',
    media: [],
  });

  beforeEach(() => jest.clearAllMocks());

  it('rejects review media that does not belong to the customer', async () => {
    const input = dto();
    input.media = [
      {
        url: 'https://res.cloudinary.com/demo/image/upload/ecommerce/reviews/other/image.jpg',
        publicId: 'ecommerce/reviews/other/image',
        resourceType: 'image',
      },
    ];

    await expect(service.create('customer-id', input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.create.mock.calls).toHaveLength(0);
  });

  it('allows owned Cloudinary review media', async () => {
    const input = dto();
    input.media = [
      {
        url: 'https://res.cloudinary.com/demo/image/upload/ecommerce/reviews/customer-id/image.jpg',
        publicId: 'ecommerce/reviews/customer-id/image',
        resourceType: 'image',
      },
    ];
    repository.create.mockResolvedValue({ id: 'review-id' } as never);

    await expect(service.create('customer-id', input)).resolves.toEqual({
      id: 'review-id',
    });
  });

  it('returns a friendly conflict when an order item was already reviewed', async () => {
    repository.create.mockRejectedValue({ code: '23505' });

    await expect(service.create('customer-id', dto())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps an ineligible order item to a bad request', async () => {
    repository.create.mockRejectedValue(
      new ReviewCreationError('NOT_ELIGIBLE', 'Không đủ điều kiện'),
    );

    await expect(service.create('customer-id', dto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns 404 when the product does not exist', async () => {
    repository.findProductReviews.mockResolvedValue(null);

    await expect(
      service.getProductReviews('missing', { page: 1, limit: 5, skip: 0 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 when replying to an unknown review', async () => {
    repository.reply.mockResolvedValue(null);

    await expect(
      service.reply('missing', 'Cảm ơn bạn', 'admin-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
