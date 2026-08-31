import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReplyReviewDto } from './review-query.dto';

describe('ReplyReviewDto', () => {
  it('accepts and trims a reply between 2 and 2000 characters', async () => {
    const dto = plainToInstance(ReplyReviewDto, {
      reply: '  Cảm ơn bạn đã đánh giá sản phẩm  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.reply).toBe('Cảm ơn bạn đã đánh giá sản phẩm');
  });

  it('rejects a reply shorter than 2 characters after trimming', async () => {
    const dto = plainToInstance(ReplyReviewDto, { reply: ' a ' });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('rejects a reply longer than 2000 characters', async () => {
    const dto = plainToInstance(ReplyReviewDto, { reply: 'a'.repeat(2001) });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
