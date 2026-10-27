import { Module } from '@nestjs/common';
import { CloudinaryController } from './cloudinary.controller.js';
import { CloudinaryService } from './cloudinary.service.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';

@Module({
  controllers: [CloudinaryController],
  providers: [CloudinaryService, AuthGuard],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
