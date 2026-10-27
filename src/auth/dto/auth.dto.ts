import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { UserRole } from '../../user/entities/enums/user.enum.js';

// Login
export class LoginDto {
  @IsString()
  @IsNotEmpty({
    message: 'Email / Số điện thoại không được bỏ trống!',
  })
  input: string;

  @IsString()
  @IsNotEmpty({
    message: 'Mật khẩu không được bỏ trống!',
  })
  password: string;
}

// Register
export class RegisterDto {
  @IsString({
    message: 'Tên không đúng định dạng!',
  })
  @IsNotEmpty({
    message: 'Tên không được bỏ trống!',
  })
  readonly full_name: string;

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

  @IsOptional()
  @IsIn([UserRole.CLIENT, UserRole.SELLER], {
    message: 'Khi đăng ký chỉ được chọn role client hoặc seller!',
  })
  readonly role?: UserRole;

  @IsString()
  @IsNotEmpty()
  readonly password: string;
}

export class SendOtpDto {
  @IsEmail({}, { message: 'Hiện tại chỉ hỗ trợ gửi OTP qua email hợp lệ!' })
  @IsNotEmpty({
    message: 'Email không được bỏ trống!',
  })
  readonly input: string;
}

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không đúng định dạng!' })
  @IsNotEmpty({
    message: 'Email không được bỏ trống!',
  })
  readonly input: string;

  @IsString()
  @IsNotEmpty({
    message: 'OTP không được bỏ trống!',
  })
  @Matches(/^\d{6}$/, {
    message: 'OTP phải gồm 6 chữ số!',
  })
  readonly otp: string;
}

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty({
    message: 'Mật khẩu không được bỏ trống!',
  })
  readonly newPassword: string;

  @IsString()
  @IsNotEmpty({
    message: 'Xác nhận mật khẩu không được bỏ trống!',
  })
  readonly confirmPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({
    message: 'Mật khẩu không được bỏ trống!',
  })
  readonly newPassword: string;

  @IsString()
  @IsNotEmpty({
    message: 'Xác nhận mật khẩu không được bỏ trống!',
  })
  readonly confirmPassword: string;
}
