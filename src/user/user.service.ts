import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';
import { UserRole, UserStatus } from '../entities/enums/user.enum.js';
import { UserResponse } from './dto/user.response.js';

type CreateUserInput = {
  full_name: string;
  email: string;
  phone: string;
  password_hash: string;
  role?: string;
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  findByEmail = async (email: string) => {
    return await this.userRepository.findOne({
      where: {
        email: email.trim(),
      },
    });
  };

  findByPhone = async (phone: string) => {
    return await this.userRepository.findOne({
      where: {
        phone: phone.trim(),
      },
    });
  };

  findById = async (id: string) => {
    return await this.userRepository.findOne({ where: { id } });
  };

  updatePassword = async (userId: string, hashedPassword: string) => {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Người dùng không tồn tại!');

    await this.userRepository.update(
      { id: userId },
      { password_hash: hashedPassword },
    );
    return true;
  };

  createUser = async (input: CreateUserInput) => {
    const { email, phone } = input;
    if (email) {
      const existEmail = await this.findByEmail(email);
      if (existEmail) throw new BadRequestException('Email đã tồn tại!');
    }
    const existPhone = await this.findByPhone(phone);
    if (existPhone) throw new BadRequestException('Số điện thoại đã tồn tại!');

    const created = await this.userRepository.save(
      this.userRepository.create({
        full_name: input.full_name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password_hash: input.password_hash,
        role: input.role ?? UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        email_verified: 0,
        avatar_url: null,
      }),
    );
    return this.convertToResponse(created);
  };

  convertToResponse = (user: User): UserResponse => new UserResponse(user);
}
