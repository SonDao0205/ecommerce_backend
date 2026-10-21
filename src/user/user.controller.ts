import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service.js';

@Controller('api/v1/user')
export class UserController {
  constructor(private readonly userService: UserService) {}
}
