import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { ApiResponseData } from '../dto/response.js';
import { UserResponse } from '../user/dto/user.response.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto.js';
import { LoginResponse } from './dto/auth.response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { ResetPasswordGuard } from '../middleware/guard/reset-password.guard.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(`/register`)
  async register(@Body() dto: RegisterDto) {
    const response = await this.authService.register(dto);

    return new ApiResponseData<UserResponse>(
      true,
      'Đăng ký tài khoản thành công!',
      response,
      HttpStatus.CREATED,
    );
  }

  @Post(`/login`)
  async login(@Body() dto: LoginDto) {
    const response = await this.authService.login(dto);

    return new ApiResponseData<LoginResponse>(
      true,
      'Đăng nhập thành công!',
      response,
      HttpStatus.OK,
    );
  }

  @UseGuards(AuthGuard)
  @Get('/me')
  async me(@Req() req: Request) {
    // request.user được AuthGuard gán sau khi verify token thành công.
    // Lấy id từ payload JWT để truy vấn thông tin user trong DB.
    const userId = (req as any).user?.id as string;

    const response = await this.authService.getMe(userId);
    return new ApiResponseData<UserResponse>(
      true,
      'Lấy thông tin người dùng thành công!',
      response,
      HttpStatus.OK,
    );
  }

  @Post('/forgot-password/otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    const response = await this.authService.sendOtp(dto);
    return new ApiResponseData<{ expires_in_seconds: number }>(
      true,
      'Đã gửi OTP, vui lòng kiểm tra email / số điện thoại!',
      response,
      HttpStatus.OK,
    );
  }

  @Post('/forgot-password/verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const response = await this.authService.verifyOtp(dto);
    return new ApiResponseData<{ reset_token: string }>(
      true,
      'Xác thực OTP thành công!',
      response,
      HttpStatus.OK,
    );
  }

  @UseGuards(AuthGuard)
  @Post('/change-password')
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const userId = (req as any).user?.id as string;
    await this.authService.changePassword(dto, userId);

    return new ApiResponseData<null>(
      true,
      'Đổi mật khẩu thành công!',
      null,
      HttpStatus.OK,
    );
  }

  @UseGuards(ResetPasswordGuard)
  @Post('/forgot-password/reset')
  async forgotPassword(@Req() req: Request, @Body() dto: ForgotPasswordDto) {
    // Token reset chỉ chứa id của user đã xác thực OTP.
    // Chỉ đổi được mật khẩu của chính user đó.
    const userId = (req as any).user?.id as string;
    await this.authService.forgotPassword(dto, userId);

    return new ApiResponseData<null>(
      true,
      'Đổi mật khẩu thành công!',
      null,
      HttpStatus.OK,
    );
  }

  @Post('/refresh-token')
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    // Nhận refresh_token từ body, trả về cặp token mới (rotation pattern)
    const response = await this.authService.refreshToken(refreshToken);
    return new ApiResponseData<{ access_token: string; refresh_token: string }>(
      true,
      'Làm mới token thành công!',
      response,
      HttpStatus.OK,
    );
  }
}
