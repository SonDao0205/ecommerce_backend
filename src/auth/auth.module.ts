import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { UserModule } from '../user/user.module.js';
import { User } from '../user/entities/user.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';

@Module({
  imports: [UserModule, TypeOrmModule.forFeature([RefreshToken])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
