import { createHash } from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from '../user/user.service.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto.js';
import { LoginResponse } from './dto/auth.response.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { UserStatus } from '../user/entities/enums/user.enum.js';
import { User } from '../user/entities/user.entity.js';

type OtpRecord = {
  otp: string;
  userId: string;
  expiresAt: number;
  attempts: number;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly otpStore = new Map<string, OtpRecord>();

  constructor(
    @Inject() private readonly userService: UserService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  register = async (dto: RegisterDto) => {
    return this.userService.createUser({
      full_name: dto.full_name,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      password: dto.password,
    });
  };

  login = async (dto: LoginDto) => {
    const { input, password } = dto;

    const exist = await this.findUserByInput(input);
    if (!exist) {
      throw new NotFoundException(
        'Email / Số điện thoại hoặc mật khẩu không đúng!',
      );
    }

    const isMatch = await bcrypt.compare(password.trim(), exist.password_hash);
    if (!isMatch) {
      throw new NotFoundException(
        'Email / Số điện thoại hoặc mật khẩu không đúng!',
      );
    }

    if (exist.status === UserStatus.LOCKED) {
      throw new ForbiddenException('Tài khoản đã bị khóa!');
    }

    const access_token = this.createAccessToken(exist);
    const refresh_token = this.createRefreshToken(exist);
    await this.saveRefreshToken(exist, refresh_token);

    return this.convertToLoginResponse(exist, access_token, refresh_token);
  };

  createAccessToken = (user: User) => {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    const exp = process.env.ACCESS_TOKEN_EXP;
    if (!secret || !exp)
      throw new BadRequestException('Cần cung cấp SECRET và EXP token!');
    const token = jwt.sign(
      {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        email_verified: user.email_verified,
      },
      String(secret),
      {
        algorithm: `HS256`,
        expiresIn: exp as SignOptions[`expiresIn`],
      },
    );

    return token;
  };

  createRefreshToken = (user: User) => {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    const exp = process.env.REFRESH_TOKEN_EXP;
    if (!secret || !exp)
      throw new BadRequestException('Cần cung cấp SECRET và EXP token!');
    const token = jwt.sign(
      {
        id: user.id,
      },
      String(secret),
      {
        algorithm: `HS256`,
        expiresIn: exp as SignOptions[`expiresIn`],
      },
    );

    return token;
  };

  refreshToken = async (token: string) => {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    if (!secret)
      throw new BadRequestException('Cần cung cấp REFRESH_TOKEN_SECRET!');

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, secret, {
        algorithms: [`HS256`],
      }) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException(
        'Refresh Token không hợp lệ hoặc đã hết hạn!',
      );
    }

    const stored = await this.refreshTokenRepository.findOne({
      where: {
        token_hash: this.hashRefreshToken(token),
        revoked: 0,
      },
    });

    if (!stored || stored.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException(
        'Refresh Token không hợp lệ hoặc đã hết hạn!',
      );
    }

    if (String(stored.user_id) !== String(payload.id)) {
      throw new UnauthorizedException(
        'Refresh Token không hợp lệ hoặc đã hết hạn!',
      );
    }

    const user = await this.userService.findById(payload.id as string);
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại!');
    if (user.status === UserStatus.LOCKED) {
      throw new ForbiddenException('Tài khoản đã bị khóa!');
    }

    stored.revoked = 1;
    await this.refreshTokenRepository.save(stored);

    const new_access_token = this.createAccessToken(user);
    const new_refresh_token = this.createRefreshToken(user);
    await this.saveRefreshToken(user, new_refresh_token);

    return { access_token: new_access_token, refresh_token: new_refresh_token };
  };

  getMe = async (userId: string) => {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Người dùng không tồn tại!');
    return this.userService.convertToResponse(user);
  };

  sendOtp = async (dto: SendOtpDto) => {
    const input = dto.input.trim();
    const exist = await this.findUserByInput(input);

    if (!exist) {
      throw new NotFoundException('Email / Số điện thoại không tồn tại!');
    }

    const otp = this.generateOtp();
    this.otpStore.set(input, {
      otp,
      userId: exist.id,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    // Tạm thời log OTP để test. Sau này thay bằng gửi email / SMS.
    console.log(`OTP quên mật khẩu cho ${input}: ${otp}`);

    return { expires_in_seconds: OTP_TTL_MS / 1000 };
  };

  verifyOtp = async (dto: VerifyOtpDto) => {
    const input = dto.input.trim();
    const otp = dto.otp.trim();
    const record = this.otpStore.get(input);

    if (!record || Date.now() > record.expiresAt) {
      this.otpStore.delete(input);
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn!');
    }

    if (record.otp !== otp) {
      record.attempts += 1;
      if (record.attempts >= OTP_MAX_ATTEMPTS) {
        this.otpStore.delete(input);
        throw new BadRequestException(
          'OTP đã nhập sai quá số lần cho phép, vui lòng gửi lại OTP!',
        );
      }
      this.otpStore.set(input, record);
      throw new BadRequestException('OTP không chính xác!');
    }

    const user = await this.userService.findById(record.userId);
    if (!user) {
      this.otpStore.delete(input);
      throw new NotFoundException('Người dùng không tồn tại!');
    }

    this.otpStore.delete(input);

    return { reset_token: this.createResetPasswordToken(user) };
  };

  forgotPassword = async (dto: ForgotPasswordDto, userId: string) => {
    await this.setNewPassword(userId, dto.newPassword, dto.confirmPassword);
    return true;
  };

  changePassword = async (dto: ChangePasswordDto, userId: string) => {
    await this.setNewPassword(userId, dto.newPassword, dto.confirmPassword);
    return true;
  };

  createResetPasswordToken = (user: User) => {
    const secret = process.env.RESET_PASSWORD_TOKEN_SECRET;
    const exp = process.env.RESET_PASSWORD_TOKEN_EXP;
    if (!secret || !exp) {
      throw new BadRequestException(
        'Cần cung cấp RESET_PASSWORD_TOKEN_SECRET và RESET_PASSWORD_TOKEN_EXP!',
      );
    }

    return jwt.sign(
      {
        id: user.id,
        purpose: 'reset_password',
      },
      String(secret),
      {
        algorithm: `HS256`,
        expiresIn: exp as SignOptions[`expiresIn`],
      },
    );
  };

  private setNewPassword = async (
    userId: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp!');
    }

    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại!');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(user.id, hashedPassword);
    await this.revokeRefreshTokens(user.id);
  };

  private saveRefreshToken = async (user: User, token: string) => {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (!decoded?.exp) {
      throw new BadRequestException('Refresh token không hợp lệ!');
    }

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        user_id: user.id,
        token_hash: this.hashRefreshToken(token),
        expires_at: new Date(decoded.exp * 1000),
        revoked: 0,
      }),
    );
  };

  private revokeRefreshTokens = async (userId: string) => {
    await this.refreshTokenRepository.update(
      { user_id: userId, revoked: 0 },
      { revoked: 1 },
    );
  };

  private hashRefreshToken = (token: string) =>
    createHash('sha256').update(token).digest('hex');

  private findUserByInput = async (input: string) => {
    const normalized = input.trim();
    return normalized.includes('@')
      ? this.userService.findByEmail(normalized)
      : this.userService.findByPhone(normalized);
  };

  private generateOtp = () =>
    String(Math.floor(100000 + Math.random() * 900000));

  convertToLoginResponse = (
    user: User,
    access_token: string,
    refresh_token: string,
  ): LoginResponse => new LoginResponse(user, access_token, refresh_token);
}
