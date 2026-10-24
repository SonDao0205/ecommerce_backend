import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UserService } from '../user/user.service.js';
import { VerifySellerDto } from './dto/verify-seller.dto.js';

@Injectable()
export class AdminService {
  constructor(@Inject() private readonly userService: UserService) {}

  verifySeller = async (dto: VerifySellerDto) => {
    const { input } = dto;
    return this.userService.updateEmailVerify(input);
  };
}
