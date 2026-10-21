import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';
import { UserRole } from '../../entities/enums/user.enum.js';

export class CreateUserDto {
  @IsString({
    message: 'Tên không đúng định dạng!',
  })
  @IsNotEmpty({
    message: 'Tên không được bỏ trống!',
  })
  readonly name: string;

  @IsEmail(
    {},
    {
      message: 'Email không đúng định dạng!',
    },
  )
  readonly email: string;

  @Matches(/(03|05|07|08|09|01[2|6|8|9])+([0-9]{8})\b/, {
    message: 'Số điện thoại không đúng định dạng!',
  })
  @IsNotEmpty({
    message: 'Số điện thoại không được bỏ trống!',
  })
  readonly phone: string;

  @IsNotEmpty({
    message: 'Role không được bỏ trống!',
  })
  @IsEnum(UserRole)
  readonly role: string;

  @IsString()
  @IsNotEmpty()
  readonly password: string;
}
