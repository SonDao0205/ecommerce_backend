import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCustomerAddressDto } from './customer-address.dto';

describe('CreateCustomerAddressDto', () => {
  const validAddress = {
    recipientName: 'Nguyễn Văn A',
    phone: '0912345678',
    address: '1 Nguyễn Huệ, Quận 1, TP.HCM',
  };

  it('accepts an omitted email for customers without email', async () => {
    const dto = plainToInstance(CreateCustomerAddressDto, validAddress);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('trims and accepts a valid email', async () => {
    const dto = plainToInstance(CreateCustomerAddressDto, {
      ...validAddress,
      email: '  customer@example.com  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBe('customer@example.com');
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(CreateCustomerAddressDto, {
      ...validAddress,
      email: 'invalid-email',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });
});
