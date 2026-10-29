import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { UserResponse } from './dto/user.response.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity.js';
import { UserRole, UserStatus } from './entities/enums/user.enum.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { AddressResponse } from './dto/address.response.js';
import { Address } from './entities/address.entity.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  findByEmail = async (email: string) => {
    const user = await this.userRepository.findOne({
      where: {
        email: ILike(email.trim()),
      },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại!');

    return user;
  };

  findByPhone = async (phone: string) => {
    const user = await this.userRepository.findOne({
      where: {
        phone: phone.trim(),
      },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại!');
    return user;
  };

  findById = async (id: string) => {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại!');
    return user;
  };

  updatePassword = async (userId: string, hashedPassword: string) => {
    await this.findById(userId);

    await this.userRepository.update(
      { id: userId },
      { password_hash: hashedPassword },
    );
    return true;
  };

  createUser = async (dto: CreateUserDto) => {
    const { email, phone, full_name, role, password } = dto;
    if (email) {
      const existEmail = await this.userRepository.findOne({
        where: { email: ILike(email.trim()) },
      });
      if (existEmail) throw new BadRequestException('Email đã tồn tại!');
    }
    const existPhone = await this.userRepository.findOne({
      where: { phone: phone.trim() },
    });
    if (existPhone) throw new BadRequestException('Số điện thoại đã tồn tại!');

    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await this.userRepository.save(
      this.userRepository.create({
        full_name: full_name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password_hash: hashedPassword,
        role: role ?? UserRole.CLIENT,
        status: UserStatus.ACTIVE,
        email_verified: 0,
        avatar_url: null,
      }),
    );
    return this.convertToResponse(created);
  };

  createAddress = async (dto: CreateAddressDto, userId: string) => {
    const {
      recipient_name,
      phone,
      province,
      district,
      ward,
      street_detail,
      is_default,
    } = dto;
    const existUser = await this.findById(userId);

    const value = {
      recipient_name,
      phone,
      province,
      district,
      ward,
      street_detail,
      is_default,
      user: existUser,
    };
    const created = await this.addressRepository.save(
      this.addressRepository.create(value),
    );

    return new AddressResponse(created);
  };

  updateEmailVerify = async (id: string) => {
    const exist = await this.findById(id);

    if (exist.email_verified)
      throw new BadRequestException('Tài khoản đã được xác thực!');
    const updated = await this.userRepository.update(
      { id: id },
      { email_verified: 1 },
    );

    return updated;
  };

  convertToResponse = (user: User): UserResponse => new UserResponse(user);
}
