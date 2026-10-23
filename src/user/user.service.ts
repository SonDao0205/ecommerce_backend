import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity.js';
import { Repository } from 'typeorm';
import { UserResponse } from './dto/user.response.js';

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
      { password: hashedPassword },
    );
    return true;
  };

  createUser = async (dto: CreateUserDto) => {
    const { email, phone } = dto;
    if (email) {
      const existEmail = await this.findByEmail(email);
      if (existEmail) throw new BadRequestException('Email đã tồn tại!');
    }
    const existPhone = await this.findByPhone(phone);
    if (existPhone) throw new BadRequestException('Số điện thoại đã tồn tại!');

    const created = await this.userRepository.save(dto);
    return this.convertToResponse(created);
  };

  convertToResponse = (user: User): UserResponse => new UserResponse(user);
}
