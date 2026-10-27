import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiResponseData } from '../dto/response.js';
import { AuthGuard } from '../middleware/guard/auth.guard.js';
import { CloudinaryService } from './cloudinary.service.js';
import type {
  CloudinaryUploadResult,
  UploadImageFile,
} from './cloudinary.service.js';
import {
  CloudinaryImageKey,
  isAllowedImageMimeType,
} from './cloudinary.service.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

@Controller('api/v1/cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (!isAllowedImageMimeType(file.mimetype)) {
          callback(
            new BadRequestException(
              'Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async upload(
    @Body('key') keyValue: string | undefined,
    @UploadedFile() file?: UploadImageFile,
  ): Promise<ApiResponseData<CloudinaryUploadResult>> {
    if (
      !keyValue ||
      !Object.values(CloudinaryImageKey).includes(
        keyValue as CloudinaryImageKey,
      )
    ) {
      throw new BadRequestException(
        `Key ảnh không hợp lệ. Các key được hỗ trợ: ${Object.values(CloudinaryImageKey).join(', ')}.`,
      );
    }
    if (!file) {
      throw new BadRequestException('Vui lòng gửi ảnh trong field "file".');
    }

    const image = await this.cloudinaryService.uploadImage(
      file,
      keyValue as CloudinaryImageKey,
    );
    return new ApiResponseData(
      true,
      'Tải ảnh lên Cloudinary thành công.',
      image,
      HttpStatus.CREATED,
    );
  }
}
