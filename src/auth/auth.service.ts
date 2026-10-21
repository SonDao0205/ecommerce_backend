import jwt, { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service.js';
import { User } from '../entities/user.entity.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { LoginResponse } from './dto/auth.response.js';

@Injectable()
export class AuthService {
  constructor(@Inject() private readonly userService: UserService) {}

  register = async (dto: RegisterDto) => {
    // Hash mật khẩu trước khi lưu vào DB, saltRounds = 10
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Ghi đè password bằng password đã được hash
    const created = await this.userService.createUser({
      ...dto,
      password: hashedPassword,
    });
    return created;
  };

  login = async (dto: LoginDto) => {
    const { input, password } = dto;

    // Tìm user theo email hoặc số điện thoại
    const exist = input.trim().endsWith(`@gmail.com`)
      ? await this.userService.findByEmail(input)
      : await this.userService.findByPhone(input);
    if (!exist)
      throw new NotFoundException(
        'Email / Số điện thoại hoặc mật khẩu không đúng!',
      );

    // So sánh password được gửi lên với password đã hash trong DB
    const isMatch = await bcrypt.compare(password.trim(), exist.password);
    if (!isMatch)
      throw new NotFoundException(
        'Email / Số điện thoại hoặc mật khẩu không đúng!',
      );

    const access_token = this.createAccessToken(exist);
    const refresh_token = this.createRefreshToken(exist);
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
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
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
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
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

    // Verify refresh token — nếu hết hạn hoặc sai chữ ký sẽ throw
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

    // Kiểm tra user vẫn còn tồn tại trong DB
    // (tránh cấp token mới cho tài khoản đã bị xoá / bị ban)
    const user = await this.userService.findById(payload.id as string);
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại!');

    // Cấp cặp token mới (access + refresh) — rotation pattern
    const new_access_token = this.createAccessToken(user);
    const new_refresh_token = this.createRefreshToken(user);

    return { access_token: new_access_token, refresh_token: new_refresh_token };
  };

  getMe = async (userId: string) => {
    // Tìm user trong DB bằng id lấy từ JWT payload
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Người dùng không tồn tại!');
    // Trả về response đã được loại bỏ các trường nhạy cảm (password…)
    return this.userService.convertToResponse(user);
  };

  convertToLoginResponse = (
    user: User,
    access_token: string,
    refresh_token: string,
  ): LoginResponse => new LoginResponse(user, access_token, refresh_token);
}
