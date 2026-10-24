import { IsNotEmpty, IsString } from 'class-validator';

export class VerifySellerDto {
  @IsString()
  @IsNotEmpty({
    message: 'Email / Số điện thoại không được bỏ trống!',
  })
  readonly input: string;
}
