import { IsBoolean, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty({
    message: 'Không được bỏ trống người dùng!',
  })
  readonly user_id: string;

  @IsString()
  @IsNotEmpty({
    message: 'Không được bỏ trống tên người nhận!',
  })
  readonly recipient_name: string;

  @IsNotEmpty({
    message: 'Không được bỏ trống số điện thoại!',
  })
  @Matches(/(03|05|07|08|09|01[2|6|8|9])+([0-9]{8})\b/, {
    message: 'Số điện thoại không đúng định dạng!',
  })
  readonly phone: string;

  @IsString()
  @IsNotEmpty({
    message: 'Không được bỏ trống province!',
  })
  readonly province: string;

  @IsString()
  @IsNotEmpty({
    message: 'Không được bỏ trống district!',
  })
  readonly district: string;

  @IsString()
  @IsNotEmpty({
    message: 'Không được bỏ trống ward!',
  })
  readonly ward: string;

  @IsString()
  @IsNotEmpty({
    message: 'Không được bỏ trống street_detail!',
  })
  readonly street_detail: string;

  @IsBoolean({
    message: 'is_default phải là kiểu boolean!',
  })
  readonly is_default: boolean;
}
