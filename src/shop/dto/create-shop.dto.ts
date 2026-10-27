import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateShopDto {
  @IsString()
  @IsNotEmpty({
    message: 'Tên cửa hàng không được bỏ trống!',
  })
  readonly name: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsString()
  @IsOptional()
  @Matches(/(03|05|07|08|09|01[2|6|8|9])+([0-9]{8})\b/, {
    message: 'Số điện thoại cửa hàng không đúng định dạng!',
  })
  readonly phone?: string;

  @IsString()
  @IsOptional()
  readonly warehouse_address?: string;
}
